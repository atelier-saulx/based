import { StrictSchema } from '@based/schema'
import { BasedDb } from '../../index.js'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
} from 'node:worker_threads'
import native from '../../native.js'
import './worker.js'
import { destructureCsmtKey, foreachDirtyBlock, specialBlock } from '../tree.js'
import { DbServer, SCHEMA_FILE } from '../index.js'
import { fileURLToPath } from 'url'
import { deepMerge } from '@saulx/utils'
import { writeFile } from 'fs/promises'

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
  fromDbServer: DbServer,
  toSchema: StrictSchema,
  transform?: TransformFns,
): Promise<DbServer['schema']> => {
  const migrationId = migrationCnt++
  fromDbServer.migrating = migrationId

  const abort = () => fromDbServer.migrating !== migrationId
  const toDb = new BasedDb({
    path: join(tmpdir(), (~~(Math.random() * 1e9)).toString(36)),
  })

  await toDb.start({ clean: true })

  if (abort()) {
    await toDb.destroy()
    return fromDbServer.schema
  }

  toSchema = await toDb.setSchema(toSchema)

  if (abort()) {
    await toDb.destroy()
    return fromDbServer.schema
  }

  const fromSchema = fromDbServer.schema
  const fromCtx = fromDbServer.dbCtxExternal
  const toCtx = toDb.server.dbCtxExternal
  const { port1, port2 } = new MessageChannel()
  const atomics = new Int32Array(new SharedArrayBuffer(4))
  const fromAddress = native.intFromExternal(fromCtx)
  const toAddress = native.intFromExternal(toCtx)
  const transformFns = parseTransform(transform)

  atomics[0] = 1

  const worker = new Worker(workerPath, {
    workerData: {
      from: fromAddress,
      to: toAddress,
      fromSchema,
      toSchema,
      channel: port2,
      atomics,
      transformFns,
    },
    transferList: [port2],
  })

  worker.on('error', console.error)

  let i = 0
  let ranges = []

  await fromDbServer.save()
  fromDbServer.merkleTree.visitLeafNodes((leaf) => {
    const [_typeId, start] = destructureCsmtKey(leaf.key)
    if (start == specialBlock) return // skip the type specialBlock
    ranges.push(leaf.data)
  })

  await Atomics.waitAsync(atomics, 0, 1).value

  while (i < ranges.length) {
    if (abort()) {
      break
    }
    // block modifies
    fromDbServer.processingQueries++
    const leafData = ranges[i++]
    port1.postMessage(leafData)
    // wake up the worker
    atomics[0] = 1
    Atomics.notify(atomics, 0)
    // wait until it's done
    await Atomics.waitAsync(atomics, 0, 1).value
    // exec queued modifies
    fromDbServer.onQueryEnd()

    if (i === ranges.length) {
      if (fromDbServer.dirtyRanges.size) {
        ranges = []
        i = 0

        foreachDirtyBlock(fromDbServer, (_mtKey, typeId, start, end) => {
          ranges.push({
            typeId,
            start,
            end,
          })
        })

        fromDbServer.dirtyRanges.clear()
      }
    }
  }

  if (abort()) {
    await Promise.all([toDb.destroy(), worker.terminate()])
    return fromDbServer.schema
  }

  let msg: any
  let schema: any
  let schemaTypesParsed: any

  while ((msg = receiveMessageOnPort(port1))) {
    ;[schema, schemaTypesParsed] = msg.message
  }

  fromDbServer.dbCtxExternal = toCtx
  fromDbServer.sortIndexes = {}
  fromDbServer.schema = deepMerge(toDb.server.schema, schema)
  fromDbServer.schemaTypesParsed = deepMerge(
    toDb.server.schemaTypesParsed,
    schemaTypesParsed,
  )
  fromDbServer.schemaTypesParsedById = {}
  for (const key in fromDbServer.schemaTypesParsed) {
    const def = fromDbServer.schemaTypesParsed[key]
    fromDbServer.schemaTypesParsedById[def.id] = def
  }

  toDb.server.dbCtxExternal = fromCtx

  const promises: Promise<any>[] = fromDbServer.workers.map((worker) =>
    worker.updateCtx(toAddress),
  )

  promises.push(
    toDb.destroy(),
    worker.terminate(),
    fromDbServer.save({ forceFullDump: true }),
    writeFile(
      join(fromDbServer.fileSystemPath, SCHEMA_FILE),
      JSON.stringify(fromDbServer.schema),
    ),
  )

  await Promise.all(promises)

  if (abort()) {
    return fromDbServer.schema
  }

  fromDbServer.onSchemaChange?.(fromDbServer.schema)

  return fromDbServer.schema
}
