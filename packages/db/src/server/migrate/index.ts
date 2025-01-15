import { StrictSchema } from '@based/schema'
import { BasedDb } from '../../index.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { Worker, MessageChannel } from 'node:worker_threads'
import native from '../../native.js'

import './worker.js'
import { foreachDirtyBlock } from '../tree.js'
import { DbServer } from '../index.js'

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
) => {
  const migrationId = migrationCnt++
  fromDbServer.migrating = migrationId
  const abort = () => fromDbServer.migrating !== migrationId
  const toDb = new BasedDb({
    path: join(tmpdir(), (~~Math.random()).toString(36)),
  })

  await toDb.start({ clean: true })

  if (abort()) {
    toDb.destroy()
    return
  }

  toDb.putSchema(toSchema)

  const fromCtx = fromDbServer.dbCtxExternal
  const toCtx = toDb.server.dbCtxExternal
  const { port1, port2 } = new MessageChannel()
  const atomics = new Int32Array(new SharedArrayBuffer(4))
  const fromAddress = native.intFromExternal(fromCtx)
  const toAddress = native.intFromExternal(toCtx)
  const transformFns = parseTransform(transform)
  const worker = new Worker('./dist/src/server/migrate/worker.js', {
    workerData: {
      from: fromAddress,
      to: toAddress,
      fromSchema: fromDbServer.schema,
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

  fromDbServer.updateMerkleTree()
  fromDbServer.dirtyRanges.clear()
  fromDbServer.merkleTree.visitLeafNodes((leaf) => {
    ranges.push(leaf.data)
  })

  console.log('ranges:', ranges.length)

  while (i < ranges.length) {
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

    if (abort()) {
      console.log('abort')
      break
    }

    if (i === ranges.length && fromDbServer.dirtyRanges.size) {
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

  if (!abort()) {
    fromDbServer.putSchema(toSchema, true)
    fromDbServer.dbCtxExternal = toCtx
    toDb.server.dbCtxExternal = fromCtx
  }

  const promises: Promise<any>[] = fromDbServer.workers.map((worker) =>
    worker.updateCtx(toAddress),
  )

  promises.push(toDb.destroy(), worker.terminate())
  await Promise.all(promises)
}
