import { QueryDef, QueryDefFilter } from '../types.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
} from '../../schema/schema.js'
import { BasedDb } from '../../index.js'
import { primitiveFilter } from './primitiveFilter.js'
import { Operator } from './operators.js'
import { Filter } from './types.js'

export { Operator, Filter }

const referencesFilter = (
  db: BasedDb,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDef['filter'],
  def: QueryDef,
): number => {
  const [fieldStr, operator, value] = filter
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree
  let d = def
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
            size += 3 + primitiveFilter(edgeDef, filter, conditions)
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
  db: BasedDb,
  filter: Filter,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  let field = schema.props[filter[0]]
  if (!field) {
    return referencesFilter(db, filter, schema, conditions, def)
  }
  return primitiveFilter(field, filter, conditions)
}

export const filter = (db: BasedDb, def: QueryDef, filter: Filter) => {
  def.filter.size += filterRaw(db, filter, def.schema, def.filter, def)
}

export const filterOr = (db: BasedDb, def: QueryDef, filter: Filter[]) => {
  if (!def.filter.or) {
    def.filter.size += 5 // [0] [next 4]
    def.filter.or = {
      size: 0,
      conditions: new Map(),
    }
  }
  for (const f of filter) {
    def.filter.or.size += filterRaw(db, f, def.schema, def.filter.or, def)
  }
  def.filter.size += def.filter.or.size
}

export const convertFilter = (
  field: string,
  operator?: Operator | boolean,
  value?: any,
): Filter[] => {
  if (operator === undefined) {
    operator = '='
    value = true
  } else if (typeof operator === 'boolean') {
    value = operator
    operator = '='
  }
  if (operator == '!..') {
    if (!Array.isArray(value)) {
      throw new Error('Invalid filter')
    }
    return [field, '>', value[1]]
  } else if (operator === '..') {
    if (!Array.isArray(value)) {
      throw new Error('Invalid filter')
    }
    return [
      [field, '>', value[0]],
      [field, '<', value[1]],
    ]
  } else {
    return [[field, operator, value]]
  }
}
