import { BasedDb } from '../../index.js'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
} from 'node:worker_threads'
import native from '../../native.js'
import { destructureCsmtKey, foreachDirtyBlock, specialBlock } from '../tree.js'
import { DbServer } from '../index.js'
import { fileURLToPath } from 'url'
import { DbSchema } from '../../schema.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from '../schema.js'
import { setToAwake, waitUntilSleeping } from './utils.js'
import { deepMerge } from '@saulx/utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')
let migrationCnt = 0

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
  const migrationId = migrationCnt++
  server.migrating = migrationId
  const abort = () => server.migrating !== migrationId

  const tmpDb = new BasedDb({
    path: null,
  })

  await tmpDb.start({ clean: true })

  if (abort()) {
    await tmpDb.destroy()
    return
  }

  setSchemaOnServer(tmpDb.server, toSchema)
  // await writeSchemaFile(this, toSchema)
  await setNativeSchema(tmpDb.server, toSchema)

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
  worker.on('error', console.error)

  // Block handling
  let i = 0
  let rangesToMigrate = []
  await server.save()
  server.merkleTree.visitLeafNodes((leaf) => {
    const [_typeId, start] = destructureCsmtKey(leaf.key)
    if (start == specialBlock) return // skip the type specialBlock
    rangesToMigrate.push(leaf.data)
  })
  await waitUntilSleeping(workerState)
  while (i < rangesToMigrate.length) {
    if (abort()) {
      break
    }
    // block modifies
    server.processingQueries++
    const leafData = rangesToMigrate[i++]
    port1.postMessage(leafData)
    setToAwake(workerState, true)
    await waitUntilSleeping(workerState)
    // exec queued modifies
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
  // make schema util for this later
  server.schemaTypesParsed = deepMerge(
    tmpDb.server.schemaTypesParsed,
    schemaTypesParsed,
  )
  server.schemaTypesParsedById = {}
  for (const key in server.schemaTypesParsed) {
    const def = server.schemaTypesParsed[key]
    server.schemaTypesParsedById[def.id] = def
  }
  // -----------------------------------------

  tmpDb.server.dbCtxExternal = fromCtx
  await writeSchemaFile(server, toSchema)

  const promises: Promise<any>[] = server.workers.map((worker) =>
    worker.updateCtx(toAddress),
  )

  promises.push(
    tmpDb.destroy(),
    worker.terminate(),
    server.save({ forceFullDump: true }),
  )

  await Promise.all(promises)

  if (abort()) {
    return
  }

  process.nextTick(() => server.emit('schema', server.schema))
}
