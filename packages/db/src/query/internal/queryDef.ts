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

    if (type === QueryDefType.Root) {
      // IDS sort
      if (t.ids) {
        q.range.limit = t.ids.length // 1k?
      } else {
        q.range.limit = 1e3 // 1k?
      }
    } else if (type === QueryDefType.References) {
      q.range.limit = 1e4 // 100k?
    }

    return q
  }
}
