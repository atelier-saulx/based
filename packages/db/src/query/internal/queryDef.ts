import { deepCopy } from '@saulx/utils'
import { BasedDb, BasedNode } from '../../index.js'
import { isPropDef, REVERSE_TYPE_INDEX_MAP } from '../../schema/types.js'
import {
  EdgeTarget,
  QueryDef,
  QueryDefEdges,
  QueryDefRest,
  QueryDefShared,
  QueryDefType,
  QueryTarget,
  Target,
} from './types.js'
import picocolors from 'picocolors'

const createEmptySharedDef = () => {
  const q: Partial<QueryDefShared> = {
    filter: { conditions: new Map(), size: 0 },
    range: { offset: 0, limit: 0 },
    include: {
      stringFields: new Set(),
      props: new Set(),
      main: {
        len: 0,
        include: {},
      },
    },
    sort: null,
    references: new Map(),
  }
  return q
}

export const createQueryDef = (
  db: BasedDb,
  type: QueryDefType,
  target: QueryTarget,
): QueryDef => {
  const queryDef = createEmptySharedDef()
  if (type === QueryDefType.Edge) {
    const t = target as EdgeTarget
    const q = queryDef as QueryDefEdges
    q.props = t.ref.edges
    q.type = type
    q.target = t
    return q
  } else {
    const t = target as Target
    const q = queryDef as QueryDefRest
    q.schema = db.schemaTypesParsed[t.type]
    q.props = q.schema.props
    q.type = type
    q.target = t
    return q
  }
}

export const debugQueryDef = (q: QueryDef, returnIt?: boolean) => {
  const loggableObject: any = { type: 'bla', schema: null }

  const f = (a) => {
    if (a === null) {
      return null
    }
    if (a instanceof BasedNode) {
      return 'basedNode'
    }
    if (a instanceof Buffer) {
      return new Uint8Array(a)
    }
    if (a instanceof Uint8Array) {
      return a
    }
    if (a instanceof Set) {
      return a
    }
    if (a instanceof Map) {
      const b = new Map()
      walk(a, b)
      return b
    } else if (typeof a === 'object') {
      if (a.type && a.include && a.filter && a.range) {
        return debugQueryDef(a, true)
      }

      if (isPropDef(a)) {
        return `${a.path.join('.')}: ${a.prop} ${REVERSE_TYPE_INDEX_MAP[a.typeIndex]}`
      } else {
        const b = Array.isArray(a) ? [] : {}
        walk(a, b)
        return b
      }
    }
    return a
  }

  const walk = (a, b) => {
    if (a instanceof Map) {
      a.forEach((v, k) => {
        b.set(k, f(v))
      })
    } else {
      for (const key in a) {
        b[key] = f(a[key])
      }
    }
  }

  walk(q, loggableObject)

  loggableObject.type = QueryDefType[q.type]
  loggableObject.schema = q.schema?.type || null

  //   for (const key in q) {
  //     if (key === 'include') {
  //       const include = {}

  //       for (const k in q[key]) {
  //         if (k === 'main') {
  //         } else {
  //           include[k] = q[key][k]
  //         }
  //       }

  //       loggableObject[key] = include
  //     } else if (key === 'schema') {
  //       if (q[key]) {
  //         loggableObject[key] = q[key].type
  //       }
  //     } else if (key === 'props') {
  //       loggableObject.props = {}
  //       for (const key in q.props) {
  //         loggableObject.props[key] =
  //           `${q.props[key].prop} ${REVERSE_TYPE_INDEX_MAP[q.props[key].typeIndex]}`
  //       }

  //   }

  if (!returnIt) {
    console.dir(loggableObject, { depth: 10 })
  }
  return loggableObject
}
