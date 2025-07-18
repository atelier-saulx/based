import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import native from '../../native.js'
import { BasedDb } from '../../index.js'
import { REFERENCE, REFERENCES } from '@based/schema/def'
import { isTypedArray } from 'node:util/types'
import { setSchemaOnServer } from '../schema.js'
import { setToSleep } from './utils.js'
import { setLocalClientSchema } from '../../client/setLocalClientSchema.js'
import { MigrateRange } from './index.js'
import { deSerialize } from '@based/schema'
import { DbSchema } from '../../schema.js'

if (isMainThread) {
  console.warn('running worker.ts in mainthread')
} else if (workerData?.isDbMigrateWorker) {
  const { from, to, fromSchema, toSchema, channel, workerState, transformFns } =
    workerData

  const fromCtx = native.externalFromInt(from)
  const toCtx = native.externalFromInt(to)

  // worker ctx init - maybe instead of this just add it on native
  // instead of here just do this in native.js
  native.workerCtxInit()

  const fromDb = new BasedDb({ path: null })
  const toDb = new BasedDb({ path: null })
  const cp = (obj: any) => {
    let copy: object

    for (const key in obj) {
      const val = obj[key]
      if (typeof val === 'number') {
        // only copy numbers
        copy ??= Array.isArray(obj) ? [] : {}
        copy[key] = val
      } else if (
        typeof val === 'object' &&
        val !== null &&
        !isTypedArray(val)
      ) {
        const res = cp(val)
        if (res) {
          copy ??= Array.isArray(obj) ? [] : {}
          copy[key] = cp(val)
        }
      }
    }

    return copy
  }

  fromDb.server.dbCtxExternal = fromCtx
  toDb.server.dbCtxExternal = toCtx

  setSchemaOnServer(fromDb.server, deSerialize(fromSchema) as DbSchema)
  setSchemaOnServer(toDb.server, deSerialize(toSchema) as DbSchema)
  setLocalClientSchema(fromDb.client, fromDb.server.schema)
  setLocalClientSchema(toDb.client, toDb.server.schema)

  try {
    const map: Record<number, { type: string; include: string[] }> = {}
    for (const type in fromDb.server.schemaTypesParsed) {
      const { id, props } = fromDb.server.schemaTypesParsed[type]
      const include = Object.keys(props)
      let i = include.length

      while (i--) {
        const path = include[i]
        if (
          props[path].typeIndex === REFERENCE ||
          props[path].typeIndex === REFERENCES
        ) {
          include[i] = `${path}.id`
          if (props[path].edges) {
            for (const key in props[path].edges) {
              const prop = props[path].edges[key]
              if (
                prop.typeIndex === REFERENCE ||
                prop.typeIndex === REFERENCES
              ) {
                include.push(`${path}.${key}.id`)
              } else {
                include.push(`${path}.${key}`)
              }
            }
          }
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
        const leafData: MigrateRange = msg.message
        const { type, include } = map[leafData.typeId]
        const typeTransformFn = transformFns[type]

        if (typeTransformFn) {
          const nodes = fromDb
            .query(type)
            .include(include)
            .range(leafData.start - 1, leafData.end)
            ._getSync(fromCtx)

          for (const node of nodes) {
            const res = typeTransformFn(node)
            if (res === null) {
              continue
            }
            if (Array.isArray(res)) {
              toDb.create(res[0], res[1] || node, { unsafe: true })
            } else {
              toDb.create(type, res || node, { unsafe: true })
            }
          }
        } else if (type in toDb.server.schemaTypesParsed) {
          const nodes = fromDb
            .query(type)
            .include(include)
            .range(leafData.start - 1, leafData.end)
            ._getSync(fromCtx)

          for (const node of nodes) {
            toDb.create(type, node, { unsafe: true })
          }
        }
      }

      await toDb.drain()
      native.membarSyncWrite()

      // WE ARE ONLY GOING TO SEND { type: lastNodeId }
      channel.postMessage(cp(toDb.server.schemaTypesParsed))

      setToSleep(workerState)
    }
  } catch (e) {
    console.error(e)
    throw e
  }
} else {
  console.info('incorrect worker db migrate')
}
