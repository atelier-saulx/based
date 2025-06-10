import { QueryDef, QueryDefFilter } from '../types.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
  ID_FIELD_DEF,
  TEXT,
  REFERENCE,
} from '@based/schema/def'
import { primitiveFilter } from './primitiveFilter.js'
import { Operator } from './types.js'
import { Filter, FilterAst, IsFilter } from './types.js'
import { DbClient } from '../../index.js'
import { langCodesMap } from '@based/schema'
import { filterFieldDoesNotExist, filterInvalidLang } from '../validation.js'

export { Operator, Filter }

const referencesFilter = (
  db: DbClient,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  const [fieldStr, ctx, value] = filter
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      if (p[0] === '$') {
        let edges = conditions.fromRef && conditions.fromRef.edges
        if (!edges && 'propDef' in def.target) {
          edges = def.target.propDef.edges
        }
        if (edges) {
          const edgeDef = edges[p]
          if (edgeDef) {
            conditions.edges ??= new Map()
            size +=
              3 +
              primitiveFilter(def, edgeDef, filter, conditions, {
                lang: def.lang.lang,
                fallbacks: [],
              })
          }
        }
      } else {
        filterFieldDoesNotExist(def, fieldStr)
        return 0
      }
      return size
    }
    if (isPropDef(t) && t.typeIndex === REFERENCE) {
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(t.prop)
      if (!refConditions) {
        const schema = db.schemaTypesParsed[t.inverseTypeName]
        size += 6
        refConditions = {
          conditions: new Map(),
          fromRef: t,
          schema,
          size: 0,
        }
        conditions.references.set(t.prop, refConditions)
      }
      // more nested
      size += filterRaw(
        db,
        [path.slice(i + 1).join('.'), ctx, value],
        refConditions.schema,
        refConditions,
        def, // incorrect...
      )
      return size
    }
  }
  if (!def) {
    filterFieldDoesNotExist(def, fieldStr)
    return 0
  }
}

export const filterRaw = (
  db: DbClient,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  const field = filter[0]
  let fieldDef = schema.props[field]
  if (!fieldDef) {
    const s = field.split('.')
    if (s.length > 1) {
      const f = s.slice(0, -1).join()
      fieldDef = schema.props[f]
      if (fieldDef && fieldDef.typeIndex === TEXT) {
        const lang = s[s.length - 1]
        const code = langCodesMap.get(lang)
        if (!code || !schema.locales[lang]) {
          filterInvalidLang(def, field)
          return 0
        }
        return primitiveFilter(def, fieldDef, filter, conditions, {
          lang: code,
          fallbacks: [],
        })
      }
    }
    if (field === 'id') {
      fieldDef = ID_FIELD_DEF
      return primitiveFilter(def, fieldDef, filter, conditions, {
        lang: def.lang.lang,
        fallbacks: [], // only fallbacks for this
      })
    }
    return referencesFilter(db, filter, schema, conditions, def)
  }
  return primitiveFilter(def, fieldDef, filter, conditions, {
    lang: def.lang.lang,
    fallbacks: [], // only fallbacks for this are we sure :/ ? can be pretty confusing
  })
}

export const filter = (
  db: DbClient,
  def: QueryDef,
  filterAst: FilterAst,
  conditions: QueryDefFilter,
) => {
  for (const f of filterAst) {
    if (IsFilter(f)) {
      conditions.size += filterRaw(db, f, def.schema, conditions, def)
    } else {
      filterOr(db, def, f, conditions)
    }
  }
}

export const filterOr = (
  db: DbClient,
  def: QueryDef,
  filterAst: FilterAst[],
  conditions: QueryDefFilter,
) => {
  if (!conditions.or) {
    conditions.size += 7 // [0] [next 4]
    conditions.or = {
      size: 0,
      conditions: new Map(),
    }
  } else {
    const r = filterOr(db, def, filterAst, conditions.or)
    conditions.size += r.size + 7
    return r
  }
  filter(db, def, filterAst, conditions.or)
  conditions.size += conditions.or.size
  return conditions.or
}
