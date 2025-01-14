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

  fromDb.server.updateMerkleTree()
  fromDb.server.dirtyRanges.clear()
  fromDb.server.merkleTree.visitLeafNodes((leaf) => {
    port1.postMessage(leaf.data)
  })

  fromDb.migrating = true
  // wake up the worker
  atomics[0] = 1
  Atomics.notify(atomics, 0)

  worker.on('error', console.error)

  while (true) {
    await Atomics.waitAsync(atomics, 0, 1).value
    if (fromDb.server.dirtyRanges.size) {
      foreachDirtyBlock(fromDb.server, (_mtKey, typeId, start, end) => {
        port1.postMessage({
          typeId,
          start,
          end,
        })
      })
      fromDb.server.dirtyRanges.clear()
    } else {
      break
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
  fromDb.migrating = false
}
