import {
  getReferenceSelect,
  QueryDef,
  QueryDefFilter,
  ReferenceSelect,
  ReferenceSelectValue,
} from '../types.js'
import { primitiveFilter } from './primitiveFilter.js'
import { type Operator } from './types.js'
import { type Filter, type FilterAst, IsFilter } from './types.js'
import { DbClient } from '../../index.js'
import {
  ID_FIELD_DEF,
  isPropDef,
  langCodesMap,
  type PropDef,
  type PropDefEdge,
  type SchemaPropTree,
  type SchemaTypeDef,
} from '../../../schema/index.js'
import { filterFieldDoesNotExist, filterInvalidLang } from '../validation.js'
import { PropType } from '../../../zigTsExports.js'

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
  let t: PropDef | PropDefEdge | SchemaPropTree = schema.tree
  let referencesSelect: ReferenceSelectValue | void
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      referencesSelect = getReferenceSelect(p, def)
      if (referencesSelect) {
        t = referencesSelect.prop
      } else if (p[0] === '$') {
        let edges = conditions.fromRef && conditions.fromRef.edges
        if (!edges && 'propDef' in def.target) {
          edges = def.target.propDef!.edges
        }
        if (edges) {
          const edgeDef = edges[p]
          if (edgeDef) {
            conditions.edges ??= new Map()
            size +=
              3 +
              primitiveFilter(def, edgeDef, filter, conditions, {
                lang: def.lang.lang,
                fallback: [],
              })
          }
        }
      } else {
        filterFieldDoesNotExist(def, fieldStr)
        return 0
      }

      if (!t) {
        return size
      }
    }

    if (
      isPropDef(t) &&
      (t.typeIndex === PropType.reference ||
        t.typeIndex === PropType.references)
    ) {
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(t.prop)
      if (!refConditions) {
        const schema = db.schemaTypesParsed[t.inverseTypeName!]
        size += t.typeIndex === PropType.references ? 11 : 6
        refConditions = {
          conditions: {
            conditions: new Map(),
            fromRef: t,
            schema,
            size: 0,
            hasSubMeta: false,
          },
          select: referencesSelect! || {
            type: ReferenceSelect.Any,
            prop: t,
          },
        }
        conditions.references.set(t.prop, refConditions)
      }
      size += filterRaw(
        db,
        [path.slice(i + 1).join('.'), ctx, value],
        refConditions.conditions.schema!,
        refConditions.conditions,
        def,
      )

      if (refConditions.conditions.hasSubMeta) {
        conditions.hasSubMeta = true
      }
      return size
    }
  }

  if (!def) {
    filterFieldDoesNotExist(def, fieldStr)
    return 0
  }

  return 0
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
      if (fieldDef && fieldDef.typeIndex === PropType.text) {
        const lang = s[s.length - 1]
        const code = langCodesMap.get(lang)
        if (!code || !schema.locales[lang]) {
          filterInvalidLang(def, field)
          return 0
        }
        return primitiveFilter(def, fieldDef, filter, conditions, {
          lang: code,
          fallback: [],
        })
      }
    }
    if (field === 'id') {
      fieldDef = ID_FIELD_DEF
      return primitiveFilter(def, fieldDef, filter, conditions, {
        lang: def.lang.lang,
        fallback: [], // only fallbacks for this
      })
    }
    return referencesFilter(db, filter, schema, conditions, def)
  }

  return primitiveFilter(def, fieldDef, filter, conditions, def.lang)
}

export const filter = (
  db: DbClient,
  def: QueryDef,
  filterAst: FilterAst,
  conditions: QueryDefFilter,
) => {
  for (const f of filterAst) {
    if (IsFilter(f)) {
      conditions.size += filterRaw(db, f, def.schema!, conditions, def)
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
      hasSubMeta: false,
    }
  } else {
    const r = filterOr(db, def, filterAst, conditions.or)
    conditions.size += r.size + 7
    return r
  }
  filter(db, def, filterAst, conditions.or)
  conditions.size += conditions.or.size

  if (conditions.or.hasSubMeta) {
    conditions.hasSubMeta = true
  }

  return conditions.or
}
