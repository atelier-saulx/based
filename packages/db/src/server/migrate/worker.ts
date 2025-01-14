import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import native from '../../native.js'
import { BasedDb } from '../../index.js'
import { TreeNode } from '../csmt/types.js'

if (isMainThread) {
  console.warn('running worker.ts in mainthread')
} else {
  const { from, to, fromSchema, toSchema, channel, atomics, transform } =
    workerData
  const fromCtx = native.externalFromInt(from)
  const toCtx = native.externalFromInt(to)
  const path = null
  const fromDb = new BasedDb({ path })
  const toDb = new BasedDb({ path })

  fromDb.server.dbCtxExternal = fromCtx
  toDb.server.dbCtxExternal = toCtx

  fromDb.putSchema(fromSchema, true)
  toDb.putSchema(toSchema, true)

  const reverseTypeMap = {}
  for (const type in fromDb.schemaTypesParsed) {
    reverseTypeMap[fromDb.schemaTypesParsed[type].id] = type
  }
  // put it to sleep
  Atomics.wait(atomics, 0, 0)

  let msg:
    | {
        message: any
      }
    | undefined
  let offset = -1
  const transformFn = transform && eval(transform)

  while (true) {
    const start = Date.now()
    let queryExecTime = 0
    let queryTotalTime = 0
    let createTime = 0
    while ((msg = receiveMessageOnPort(channel))) {
      const leafData: TreeNode['data'] = msg.message
      const typeStr = reverseTypeMap[leafData.typeId]
      const qstart = Date.now()
      const nodes = fromDb
        .query(typeStr)
        .range(leafData.start + offset, leafData.end - leafData.start)
        ._getSync()

      queryExecTime = nodes.execTime
      queryTotalTime += Date.now() - qstart

      const cstart = Date.now()
      for (const node of nodes) {
        if (node.id > leafData.end) {
          offset += node.id - leafData.end
          break
        }
        toDb.create(
          typeStr,
          (transformFn && transformFn(typeStr, node)) || node,
          true,
        )
      }

      createTime += Date.now() - cstart
    }

    const totalTime = Date.now() - start
    const drainTime = toDb.drain()

    console.log({
      totalTime,
      queryExecTime,
      queryTotalTime,
      drainTime,
      createTime,
    })

    // put it to sleep
    atomics[0] = 0
    Atomics.notify(atomics, 0)
    Atomics.wait(atomics, 0, 0)
  }
}
