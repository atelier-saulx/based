import { Schema } from '@based/schema'
import { BasedDb } from '../index.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { Worker, MessageChannel } from 'node:worker_threads'
import native from '../native.js'

import './worker.js'
export const migrate = async (
  fromDb: BasedDb,
  toSchema: Schema,
  transform?: (type: string, node: Record<string, any>) => Record<string, any>,
) => {
  const toDb = new BasedDb({
    path: join(tmpdir(), (~~Math.random()).toString(36)),
  })

  await toDb.start({ clean: true })
  toDb.putSchema(toSchema)
  const fromCtx = fromDb.dbCtxExternal
  const toCtx = toDb.dbCtxExternal
  // TODO make a pool!
  const { port1, port2 } = new MessageChannel()
  const atomics = new Int32Array(new SharedArrayBuffer(4))
  const worker = new Worker('./dist/src/migrate/worker.js', {
    workerData: {
      from: native.intFromExternal(fromCtx),
      to: native.intFromExternal(toCtx),
      fromSchema: fromDb.schema,
      toSchema,
      channel: port2,
      atomics,
      transform: transform.toString(),
    },
    transferList: [port2],
  })

  fromDb.save()
  fromDb.merkleTree.visitLeafNodes((leaf) => {
    port1.postMessage(leaf.data)
  })
  // wake up the worker
  atomics[0] = 1
  Atomics.notify(atomics, 0)

  const exitCode = await new Promise((resolve) => {
    worker.on('exit', resolve)
  })

  if (exitCode === 0) {
    // success
    fromDb.putSchema(toSchema, true)
    fromDb.dbCtxExternal = toCtx
    toDb.dbCtxExternal = fromCtx
  }

  await toDb.stop(true)
}
