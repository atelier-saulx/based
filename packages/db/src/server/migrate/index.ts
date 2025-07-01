import { BasedDb, save } from '../../index.js'
import { dirname, join } from 'path'
import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
} from 'node:worker_threads'
import native from '../../native.js'
import { destructureTreeKey } from '../tree.js'
import { foreachDirtyBlock } from '../blocks.js'
import { DbServer } from '../index.js'
import { fileURLToPath } from 'url'
import { DbSchema } from '../../schema.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from '../schema.js'
import { setToAwake, waitUntilSleeping } from './utils.js'

export type MigrateRange = { typeId: number; start: number; end: number }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

type TransformFn = (
  node: Record<string, any>,
) => Record<string, any> | [string, Record<string, any>]

export type TransformFns = Record<string, TransformFn>

const parseTransform = (transform?: TransformFns) => {
  const res = {}
  if (typeof transform === 'object' && transform !== null) {
    for (const type in transform) {
      const fn = transform[type]
      if (typeof fn === 'function') {
        let src = fn.toString()
        const trimmedForCheckOnly = src.replace(/\s+/g, '')
        if (trimmedForCheckOnly.startsWith(type + '(')) {
          src = 'function ' + src
        }
        res[type] = src
      }
    }
  }
  return res
}

export const migrate = async (
  server: DbServer,
  fromSchema: DbSchema,
  toSchema: DbSchema,
  transform?: TransformFns,
): Promise<void> => {
  const migrationId = toSchema.hash
  server.migrating = migrationId
  server.emit('info', `migrating schema ${migrationId}`)

  let killed = false
  const abort = () => {
    if (killed) {
      server.emit(
        'info',
        `migration killed something went wrong ${migrationId}`,
      )
      return true
    }
    const newMigrationInProgress = server.migrating !== migrationId
    if (newMigrationInProgress) {
      server.emit(
        'info',
        `abort migration - migrating: ${server.migrating} abort: ${migrationId}`,
      )
    }
    return newMigrationInProgress
  }

  const tmpDb = new BasedDb({
    path: null,
  })

  await tmpDb.start({
    clean: true,
    delayInMs: server.delayInMs,
    queryThreads: 0,
  })

  if (abort()) {
    await tmpDb.destroy()
    return
  }

  setSchemaOnServer(tmpDb.server, toSchema)
  setNativeSchema(tmpDb.server, toSchema)

  if (abort()) {
    await tmpDb.destroy()
    return
  }

  const fromCtx = server.dbCtxExternal
  const toCtx = tmpDb.server.dbCtxExternal
  const { port1, port2 } = new MessageChannel()
  const workerState = new Int32Array(new SharedArrayBuffer(4))
  const fromAddress = native.intFromExternal(fromCtx)
  const toAddress = native.intFromExternal(toCtx)
  const transformFns = parseTransform(transform)

  setToAwake(workerState, false)

  const worker = new Worker(workerPath, {
    workerData: {
      isDbMigrateWorker: true,
      from: fromAddress,
      to: toAddress,
      fromSchema,
      toSchema,
      channel: port2,
      workerState,
      transformFns,
    },
    transferList: [port2],
  })

  // handle?

  worker.on('error', (err) => {
    killed = true
    console.error(`Error in migration ${err.message}`)
  })

  // Block handling
  let i = 0
  let rangesToMigrate: MigrateRange[] = []

  await save(server, false, true)
  server.verifTree.foreachBlock((block) => {
    const [typeId, start] = destructureTreeKey(block.key)
    const def = server.schemaTypesParsedById[typeId]
    const end = start + def.blockCapacity - 1

    rangesToMigrate.push({ typeId, start, end })
  })

  await waitUntilSleeping(workerState)

  while (i < rangesToMigrate.length) {
    if (abort()) {
      break
    }
    // block modifies
    server.activeReaders++
    const leafData = rangesToMigrate[i++]
    port1.postMessage(leafData)
    setToAwake(workerState, true)
    await waitUntilSleeping(workerState)
    // exec queued modifies
    server.activeReaders--
    server.onQueryEnd()
    if (i === rangesToMigrate.length) {
      if (server.dirtyRanges.size) {
        rangesToMigrate = []
        i = 0
        foreachDirtyBlock(server, (_mtKey, typeId, start, end) => {
          rangesToMigrate.push({
            typeId,
            start,
            end,
          })
        })
        server.dirtyRanges.clear()
      }
    }
  }
  // ---------------------------------

  if (abort()) {
    await Promise.all([tmpDb.destroy(), worker.terminate()])
    return
  }

  let msg: any
  let schemaTypesParsed: any

  while ((msg = receiveMessageOnPort(port1))) {
    schemaTypesParsed = msg.message
  }

  server.dbCtxExternal = toCtx
  server.sortIndexes = {}

  // ----------------MAKE NICE THIS------------------
  // pass last node IDS { type: lastId }
  setSchemaOnServer(server, toSchema)

  for (const key in schemaTypesParsed) {
    // maybe only send the lastId
    const def = server.schemaTypesParsed[key]
    def.lastId = schemaTypesParsed[key].lastId
  }
  // -----------------------------------------

  tmpDb.server.dbCtxExternal = fromCtx

  // TODO makes this SYNC
  const promises: Promise<any>[] = server.workers.map((worker) =>
    worker.updateCtx(toAddress),
  )

  promises.push(tmpDb.destroy(), worker.terminate())

  await Promise.all(promises)

  if (abort()) {
    return
  }

  native.membarSyncRead()
  await save(server, true, true)
  await writeSchemaFile(server, toSchema)

  server.migrating = 0
  process.nextTick(() => server.emit('schema', server.schema))
}
