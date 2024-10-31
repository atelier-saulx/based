import { Schema } from '@based/schema'
import { BasedDb } from '../index.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { Worker } from 'node:worker_threads'
import native from '../native.js'

import './worker.js'
export const migrate = async (fromDb: BasedDb, toSchema: Schema) => {
  fromDb.save()
  console.log('migrate time!', fromDb.merkleTree)
  fromDb.merkleTree.visitLeafNodes((leaf) => {
    console.log('->', leaf)
  })
  // get current block descriptors

  // make new db
  const toDb = new BasedDb({
    path: join(tmpdir(), (~~Math.random()).toString(36)),
  })

  await toDb.start({ clean: true })
  toDb.putSchema(toSchema)
  const fromCtx = fromDb.dbCtxExternal
  const toCtx = toDb.dbCtxExternal

  await new Promise<void>((resolve) => {
    const worker = new Worker('./dist/src/migrate/worker.js', {
      workerData: {
        from: native.intFromExternal(fromCtx),
        to: native.intFromExternal(toCtx),
        fromSchema: fromDb.schema,
        toSchema,
      },
    })
    worker.once('message', (code) => {
      console.log('MIGRATE WORKER CODE:', { code })
      resolve()
    })
  })
}
