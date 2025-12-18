import { BasedDb, initDefaultSubscriptions, save } from '../../index.js'
import { dirname, join } from 'path'
import { Worker, MessageChannel } from 'node:worker_threads'
import native from '../../native.js'
import { destructureTreeKey } from '../tree.js'
import { foreachDirtyBlock } from '../blocks.js'
import { DbServer } from '../index.js'
import { fileURLToPath } from 'url'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from '../schema.js'
import { setToAwake, waitUntilSleeping } from './utils.js'
import { DbSchema, MigrateFns, serialize } from '@based/schema'
import { semver } from '@based/schema'
import { tmpdir } from 'node:os'
const { satisfies, parseRange, parse } = semver

export type MigrateRange = { typeId: number; start: number; end: number }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

const parseTransform = (transform?: MigrateFns) => {
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

const stripHooks = (schema: DbSchema): DbSchema => {
  const res = {}
  for (const i in schema) {
    if (i === 'types') {
      res[i] = {}
      for (const type in schema.types) {
        const { hooks: _, ...rest } = schema.types[type]
        res[i][type] = rest
      }
    } else {
      res[i] = schema[i]
    }
  }
  return res as DbSchema
}

export const migrate = async (
  server: DbServer,
  fromSchema: DbSchema,
  toSchema: DbSchema,
  transform?: MigrateFns,
): Promise<true | void> => {
  const migrationId = toSchema.hash

  server.migrating = migrationId
  server.emit('info', `migrating schema ${migrationId}`)

  fromSchema = stripHooks(fromSchema)
  toSchema = stripHooks(toSchema)

  if (!transform && toSchema.migrations?.length) {
    const fromVersion = fromSchema.version || '0.0.0'
    transform = {}
    for (const { migrate, version } of toSchema.migrations) {
      if (satisfies(parse(fromVersion), parseRange(version))) {
        for (const type in migrate) {
          transform[type] = migrate[type]
        }
      }
    }
  }

  let killed = false
  const abort = () => {
    if (server.stopped) {
      console.info(`server stopped during migration ${migrationId}`)
      return true
    }
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
    path: null, //join(tmpdir(), String(Math.random())),
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
      fromSchema: serialize(fromSchema, {
        stripMetaInformation: true,
      }),
      toSchema: serialize(toSchema, {
        stripMetaInformation: true,
      }),
      channel: port2,
      workerState,
      transformFns,
    },
    transferList: [port2],
  })

  // handle?
  const errorPromise = new Promise<void>((resolve) => {
    worker.once('error', (err) => {
      killed = true
      console.error(`Error in migration ${err.message}, aborting migration`)
      resolve()
    })
  })

  // Block handling
  let i = 0
  let rangesToMigrate: MigrateRange[] = []

  await save(server, { skipMigrationCheck: true })

  server.verifTree.foreachBlock((block) => {
    const [typeId, start] = destructureTreeKey(block.key)
    const def = server.schemaTypesParsedById[typeId]
    const end = start + def.blockCapacity - 1
    rangesToMigrate.push({ typeId, start, end })
  })

  rangesToMigrate.sort((a, b) => {
    const typeA = server.schemaTypesParsedById[a.typeId]
    const typeB = server.schemaTypesParsedById[b.typeId]

    for (const k in typeA.props) {
      const prop = typeA.props[k]
      if (prop.dependent && prop.inverseTypeName === typeB.type) {
        return 1
      }
    }

    for (const k in typeB.props) {
      const prop = typeB.props[k]
      if (prop.dependent && prop.inverseTypeName === typeA.type) {
        return -1
      }
    }

    return 0
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
    await Promise.race([errorPromise, waitUntilSleeping(workerState)])
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

  server.dbCtxExternal = toCtx
  server.sortIndexes = {}
  server.subscriptions = initDefaultSubscriptions()
  setSchemaOnServer(server, toSchema)
  tmpDb.server.dbCtxExternal = fromCtx
  // TODO makes this SYNC
  const promises: Promise<any>[] = [server.ioWorker, ...server.workers].map(
    (worker) => worker.updateCtx(toAddress),
  )
  promises.push(worker.terminate())
  await Promise.all(promises)
  if (abort()) {
    return
  }
  tmpDb.destroy()
  native.membarSyncRead()

  await save(server, {
    forceFullDump: true,
    skipDirtyCheck: true,
    skipMigrationCheck: true,
  })

  await writeSchemaFile(server, toSchema)
  server.migrating = 0
  process.nextTick(() => server.emit('schema', server.schema))
  return true
}
