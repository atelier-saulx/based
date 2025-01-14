import { StrictSchema } from '@based/schema'
import { BasedDb } from '../../index.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { Worker, MessageChannel } from 'node:worker_threads'
import native from '../../native.js'

import './worker.js'
import { foreachDirtyBlock } from '../tree.js'
export const migrate = async (
  fromDb: BasedDb,
  toSchema: StrictSchema,
  transform?: (type: string, node: Record<string, any>) => Record<string, any>,
) => {
  const toDb = new BasedDb({
    path: join(tmpdir(), (~~Math.random()).toString(36)),
  })

  await toDb.start({ clean: true })
  toDb.putSchema(toSchema)
  const fromCtx = fromDb.server.dbCtxExternal
  const toCtx = toDb.server.dbCtxExternal
  // TODO make a pool!
  const { port1, port2 } = new MessageChannel()
  const atomics = new Int32Array(new SharedArrayBuffer(4))
  const fromAddress = native.intFromExternal(fromCtx)
  const toAddress = native.intFromExternal(toCtx)
  const worker = new Worker('./dist/src/server/migrate/worker.js', {
    workerData: {
      from: fromAddress,
      to: toAddress,
      fromSchema: fromDb.server.schema,
      toSchema,
      channel: port2,
      atomics,
      transform: transform.toString(),
    },
    transferList: [port2],
  })

  worker.on('error', console.error)

  let i = 0
  let ranges = []

  fromDb.server.updateMerkleTree()
  fromDb.server.dirtyRanges.clear()
  fromDb.server.merkleTree.visitLeafNodes((leaf) => {
    ranges.push(leaf.data)
  })

  while (i < ranges.length) {
    // block modifies
    fromDb.server.processingQueries++
    const leafData = ranges[i++]
    port1.postMessage(leafData)
    // wake up the worker
    atomics[0] = 1
    Atomics.notify(atomics, 0)
    // wait until it's done
    await Atomics.waitAsync(atomics, 0, 1).value
    // exec queued modifies
    fromDb.server.onQueryEnd()

    if (i === ranges.length && fromDb.server.dirtyRanges.size) {
      ranges = []
      i = 0
      foreachDirtyBlock(fromDb.server, (_mtKey, typeId, start, end) => {
        ranges.push({
          typeId,
          start,
          end,
        })
      })
      fromDb.server.dirtyRanges.clear()
    }
  }

  fromDb.putSchema(toSchema, true)
  fromDb.server.dbCtxExternal = toCtx
  toDb.server.dbCtxExternal = fromCtx

  const promises: Promise<any>[] = fromDb.server.workers.map((worker) =>
    worker.updateCtx(toAddress),
  )
  promises.push(toDb.stop(true), worker.terminate())
  await Promise.all(promises)
}
