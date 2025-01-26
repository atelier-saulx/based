import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import native from '../../native.js'
import { BasedDb } from '../../index.js'
import { TreeNode } from '../csmt/types.js'
import { REFERENCE, REFERENCES } from '../schema/types.js'
import { setTimeout } from 'node:timers/promises'

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

  await fromDb.putSchema(fromSchema, true)
  await toDb.putSchema(toSchema, true)

  const map: Record<number, { type: string; include: string[] }> = {}
  for (const type in fromDb.client.schemaTypesParsed) {
    const { id, props } = fromDb.client.schemaTypesParsed[type]
    const include = Object.keys(props)
    let i = include.length
    while (i--) {
      const path = include[i]
      if (
        props[path].typeIndex === REFERENCE ||
        props[path].typeIndex === REFERENCES
      ) {
        include[i] = `${path}.id`
      }
    }
    map[id] = { type, include }
  }

  for (const type in transformFns) {
    const fnOrNull = transformFns[type]
    transformFns[type] = eval(`(${fnOrNull})`)
  }

  while (true) {
    let msg: any
    while ((msg = receiveMessageOnPort(channel))) {
      const leafData: TreeNode['data'] = msg.message
      const { type, include } = map[leafData.typeId]
      const typeTransformFn = transformFns[type]
      if (typeTransformFn) {
        const nodes = fromDb
          .query(type)
          .include(include)
          .range(leafData.start - 1, leafData.end - leafData.start + 1)
          ._getSync(fromCtx)
        for (const node of nodes) {
          const res = typeTransformFn(node)
          if (res === null) {
            continue
          }
          if (Array.isArray(res)) {
            toDb.create(res[0], res[1] || node, true)
          } else {
            toDb.create(type, res || node, true)
          }
        }
      } else if (type in toDb.client.schemaTypesParsed) {
        const nodes = fromDb
          .query(type)
          .include(include)
          .range(leafData.start - 1, leafData.end - leafData.start + 1)
          ._getSync(fromCtx)
        for (const node of nodes) {
          toDb.create(type, node, true)
        }
      }
    }

    await toDb.drain()
    // await setTimeout()
    // put it to sleep
    atomics[0] = 0
    Atomics.notify(atomics, 0)
    Atomics.wait(atomics, 0, 0)
  }
}
