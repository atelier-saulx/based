import { QueryDef, QueryDefFilter, QueryDefShared } from '../types.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
} from '../../schema/schema.js'
import { BasedDb } from '../../index.js'
import { primitiveFilter, Operation } from './primitiveFilter.js'

export { Operation }

const referencesFilter = (
  db: BasedDb,
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryDef['filter'],
  def: QueryDef,
): number => {
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      if (p[0] === '$') {
        if ('propDef' in def.target) {
          const edgeDef = def.target.propDef.edges?.[p]
          if (edgeDef) {
            conditions.edges ??= new Map()
            size += 1 + primitiveFilter(edgeDef, operator, value, conditions)
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
      size += filterRaw(
        db,
        path.slice(i + 1).join('.'),
        operator,
        value,
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
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
  def: QueryDef,
): number => {
  let field = schema.props[fieldStr]
  if (!field) {
    return referencesFilter(
      db,
      fieldStr,
      operator,
      value,
      schema,
      conditions,
      def,
    )
  }
  return primitiveFilter(field, operator, value, conditions)
}

export const filter = (
  db: BasedDb,
  def: QueryDef,
  fieldStr: string,
  operator: Operation,
  value: any,
) => {
  def.filter.size += filterRaw(
    db,
    fieldStr,
    operator,
    value,
    def.schema,
    def.filter,
    def,
  )
}
