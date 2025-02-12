import { QueryDef, QueryDefFilter } from '../types.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
  ID_FIELD_DEF,
  TEXT,
} from '../../../server/schema/schema.js'
import { primitiveFilter } from './primitiveFilter.js'
import { Operator } from './operators.js'
import { Filter, FilterAst, IsFilter } from './types.js'
import { hasField, checkOperator, checkValue } from '../validation.js'
import { DbClient } from '../../index.js'
import { langCodesMap } from '@based/schema'

export { Operator, Filter }

const referencesFilter = (
  db: DbClient,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  const [fieldStr, operator, value] = filter
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree

  hasField(fieldStr)
  checkOperator(operator)
  checkValue(value, operator)

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
            size += 3 + primitiveFilter(edgeDef, filter, conditions, def.lang)
          }
        }
      }
      return size
    }
    if (isPropDef(t) && t.typeIndex === 13) {
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
        [path.slice(i + 1).join('.'), operator, value],
        refConditions.schema,
        refConditions,
        def, // incorrect...
      )
      return size
    }
  }
  console.error(
    `Querty: field "${fieldStr}" does not exist on type ${schema.type}`,
  )
  return size
}

export const filterRaw = (
  db: DbClient,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  const [field, operator, value] = filter

  hasField(field) // Validates if the field is a non-empty string
  checkOperator(operator) // Validates if the operator is valid
  checkValue(value, operator) // Validates the value based on the operator

  let fieldDef = schema.props[field]

  if (!fieldDef) {
    const s = field.split('.')
    if (s.length > 1) {
      const f = s.slice(0, -1).join()
      fieldDef = schema.props[f]
      if (fieldDef && fieldDef.typeIndex === TEXT) {
        const code = langCodesMap.get(s[s.length - 1])
        if (!code) {
          throw new Error(
            `Invalid value for filter on ${field}: expected a valid locale`,
          )
        }
        return primitiveFilter(fieldDef, filter, conditions, code)
      }
    }

    if (field === 'id') {
      fieldDef = ID_FIELD_DEF
      return primitiveFilter(fieldDef, filter, conditions, def.lang)
    }
    return referencesFilter(db, filter, schema, conditions, def)
  }
  return primitiveFilter(fieldDef, filter, conditions, def.lang)
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
  }
  filter(db, def, filterAst, conditions.or)
  conditions.size += conditions.or.size
  return conditions.or
}

const normalizeNeedle = (s: string): string => {
  return s
    .normalize('NFKD')
    .split('')
    .filter((ch: string) => ch.charCodeAt(0) <= 127)
    .join('')
}

export const convertFilter = (
  field: string,
  operator?: Operator | boolean,
  value?: any,
): FilterAst => {
  if (operator === undefined) {
    operator = '='
    value = true
  } else if (typeof operator === 'boolean') {
    value = operator
    operator = '='
  }
  hasField(field)
  checkOperator(operator)
  checkValue(value, operator)
  if (operator === '!..') {
    return [
      [field, '>', value[1]],
      [field, '<', value[0]],
    ]
  } else if (operator === '..') {
    return [
      [field, '>', value[0]],
      [field, '<', value[1]],
    ]
  } else {
    if (operator == 'like') {
      if (value == null) {
        throw new Error('Value is required')
      }
      if (value?.normalize) {
        value = normalizeNeedle(value)
      } else if (Array.isArray(value)) {
        if (value[0]?.normalize) {
          value = value.map(normalizeNeedle)
        } else if (value[0]?.BYTES_PER_ELEMENT > 1) {
          value = value.map((v) => v.buffer)
        }
      } else if (value?.BYTES_PER_ELEMENT > 1) {
        value = value.buffer
      }
    }
    return [[field, operator, value]]
  }
}
