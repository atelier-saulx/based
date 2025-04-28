import { langCodesMap } from '@based/schema'
import { DbClient } from '../index.js'
import { DEF_RANGE_PROP_LIMIT, DEF_RANGE_REF_LIMIT } from './thresholds.js'
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
import {
  validateAlias,
  validateId,
  validateIds,
  validateType,
} from './validation.js'

const createEmptySharedDef = (skipValidation: boolean) => {
  const q: Partial<QueryDefShared> = {
    errors: [],
    skipValidation,
    filter: { conditions: new Map(), size: 0 },
    range: { offset: 0, limit: 0 },
    lang: langCodesMap.get('none'),
    include: {
      langTextFields: new Map(),
      stringFields: new Set(),
      props: new Map(),
      propsRead: {},
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
  db: DbClient,
  type: QueryDefType,
  target: QueryTarget,
  skipValidation: boolean,
): QueryDef => {
  const queryDef = createEmptySharedDef(skipValidation)
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
    q.schema = validateType(db, q, t.type)
    q.props = q.schema.props
    q.type = type
    q.target = t
    if (type === QueryDefType.Root) {
      if (t.id) {
        t.id = validateId(q, t.id)
      } else if (t.ids) {
        t.ids = validateIds(q, t.ids)
        q.range.limit = t.ids.length
      } else if (t.alias) {
        t.resolvedAlias = validateAlias(q, t.alias)
      } else {
        q.range.limit = DEF_RANGE_PROP_LIMIT
      }
    } else if (type === QueryDefType.References) {
      q.range.limit = DEF_RANGE_REF_LIMIT
    }
    return q
  }
}
