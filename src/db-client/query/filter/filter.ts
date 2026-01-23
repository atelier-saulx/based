import { PropType } from '../../../zigTsExports.js'
import { DbClient } from '../../index.js'
import { QueryDefFilter } from '../types.js'
import { createCondition } from './condition.js'
import { FilterOpts, Operator } from './types.js'

export const filter = (
  db: DbClient,
  def: QueryDefFilter,
  field: string,
  // TODO: this is tmp will become user operator
  operator?: Operator,
  value?: any,
  opts?: FilterOpts,
): void => {
  if (operator === undefined) {
    operator = '='
  }

  let propDef = def.props[field]

  if (!propDef) {
    const path = field.split('.')
    let currentSelect
    let props = def.props
    // index if last is ref then this is wrong
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i]
      currentSelect = props[segment]

      // segment[0] === $ // handle EDGE

      if (
        currentSelect.typeIndex === PropType.reference ||
        currentSelect.typeIndex === PropType.references
      ) {
        if (!def.references) {
          def.references = new Map()
        }
        let refDef = def.references.get(currentSelect.prop)
        if (!refDef) {
          refDef = {
            ref: currentSelect,
            conditions: new Map(),
            props: db.schemaTypesParsed[currentSelect.schema.ref].props,
          }
          def.references.set(currentSelect.prop, refDef)
        }
        // console.log('CONTINUE', path.slice(i + 1).join('.'))
        return filter(
          db,
          refDef,
          path.slice(i + 1).join('.'),
          operator,
          value,
          opts,
        )
      } else if (currentSelect.typeIndex === PropType.object) {
        console.log('GOT OBJECT HANDLE IT')
        // set props PROPS
      }

      // for object and text but wait until we handle that ourselves
      currentSelect = props[path[path.length - 1]]

      // make 1 fn to handle all this stuff

      console.log(currentSelect)

      if (!currentSelect) {
        throw new Error(`Property ${field} in filter not found`)
      }
    }
    // not enough ofc
    propDef = currentSelect
    // nested prop find it
  }

  if (!propDef) {
    throw new Error(`Property ${field} in filter not found`)
  }

  // This is temp here for subscriptions
  if (propDef.prop === 0) {
    if (!def.partialOffsets) {
      def.partialOffsets = new Set()
    }
    def.partialOffsets.add(propDef.start || 0)
  }

  const conditions =
    def.conditions.get(propDef.prop) ??
    def.conditions.set(propDef.prop, []).get(propDef.prop) ??
    [] // for typescript...

  if (value !== undefined && !(value instanceof Array)) {
    value = [value]
  }

  // For now
  if (value == undefined) {
    return
  }

  const condition = createCondition(propDef, operator!, value, opts)

  // When all values are handled this is not nessecary
  if (condition) {
    conditions.push(condition)
  }
}

export const or = (
  db: DbClient,
  def: QueryDefFilter,
  field: string,
  operator?: Operator,
  value?: any,
  opts?: FilterOpts,
) => {
  if (operator === undefined) {
    operator = '='
  }
  if (!def.or) {
    def.or = {
      conditions: new Map(),
      props: def.props || {},
    }
    filter(db, def.or, field, operator, value, opts)
    return def.or
  } else {
    return or(db, def.or, field, operator, value, opts)
  }
}
