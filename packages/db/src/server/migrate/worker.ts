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
  const { from, to, fromSchema, toSchema, channel, atomics, transformFns } =
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

  for (const type in transformFns) {
    const fnOrNull = transformFns[type]
    transformFns[type] = eval(`(${fnOrNull})`)
  }

  while (true) {
    let msg: any
    while ((msg = receiveMessageOnPort(channel))) {
      const leafData: TreeNode['data'] = msg.message
      const typeStr = reverseTypeMap[leafData.typeId]
      const typeTransformFn = transformFns[typeStr]

      if (typeTransformFn) {
        const nodes = fromDb
          .query(typeStr)
          .range(leafData.start - 1, leafData.end - leafData.start + 1)
          ._getSync()
        for (const node of nodes) {
          const res = typeTransformFn(node)
          if (res === null) {
            continue
          }
          if (Array.isArray(res)) {
            toDb.create(res[0], res[1] || node, true)
          } else {
            toDb.create(typeStr, res || node, true)
          }
        }
      } else if (typeStr in toDb.schemaTypesParsed) {
        const nodes = fromDb
          .query(typeStr)
          .range(leafData.start - 1, leafData.end - leafData.start + 1)
          ._getSync()
        for (const node of nodes) {
          toDb.create(typeStr, node, true)
        }
      }
    }

    toDb.drain()
    // put it to sleep
    atomics[0] = 0
    Atomics.notify(atomics, 0)
    Atomics.wait(atomics, 0, 0)
  }
}
