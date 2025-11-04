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
  QueryType,
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
    lang: {
      lang: langCodesMap.get('none'),
      fallback: [],
    },
    include: {
      stringFields: new Map(),
      props: new Map(),
      main: {
        len: 0,
        include: {},
      },
    },
    aggregate: null,
    sort: null,
    references: new Map(),
  }
  return q
}

type CreateQueryDefReturn<T extends QueryDefType> = T extends QueryDefType.Edge
  ? QueryDefEdges
  : T extends
        | QueryDefType.Root
        | QueryDefType.Reference
        | QueryDefType.References
    ? QueryDefRest
    : QueryDef

export function createQueryDef<T extends QueryDefType>(
  db: DbClient,
  type: T,
  target: T extends QueryDefType.Edge ? EdgeTarget : Target,
  skipValidation: boolean,
): CreateQueryDefReturn<T> {
  const queryDef = createEmptySharedDef(skipValidation)
  if (type === QueryDefType.Edge) {
    const t = target as EdgeTarget
    const q = queryDef as QueryDefEdges
    q.props = t.ref.edges
    q.type = type
    q.target = t
    return q as CreateQueryDefReturn<T>
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
        q.queryType = QueryType.id
      } else if (t.ids) {
        q.queryType = QueryType.ids
        t.ids = validateIds(q, t.ids)
        q.range.limit = t.ids.length
      } else if (t.alias) {
        q.queryType = QueryType.alias
        t.resolvedAlias = validateAlias(q, t.alias)
      } else {
        q.queryType = QueryType.default
        q.range.limit = DEF_RANGE_PROP_LIMIT
      }
    } else if (type === QueryDefType.References) {
      q.range.limit = DEF_RANGE_REF_LIMIT
    }
    return q as CreateQueryDefReturn<T>
  }
}
