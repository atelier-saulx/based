import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import native from '../native.js'
import { BasedDb } from '../index.js'

if (isMainThread) {
  console.warn('this is wrong, running worker.ts in mainthread')
} else {
  const { from, to, fromSchema, toSchema } = workerData
  const fromCtx = native.externalFromInt(from)
  const toCtx = native.externalFromInt(to)
  const path = null
  const fromDb = new BasedDb({ path })
  const toDb = new BasedDb({ path })

  fromDb.dbCtxExternal = fromCtx
  toDb.dbCtxExternal = toCtx

  fromDb.putSchema(fromSchema, true)
  toDb.putSchema(toSchema, true)

  console.log('YAYA')
  console.log('---', fromDb.query('user').get().toObject())
  parentPort.postMessage(0)
}
