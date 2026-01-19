import { PropDef, PropDefEdge } from '../../../schema.js'
import { writeUint16, writeUint32 } from '../../../utils/uint8.js'
import {
  FilterConditionByteSize,
  FilterOp,
  FilterOpInverse,
  PropType,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { DbClient } from '../../index.js'
import { QueryDefFilter } from '../types.js'
import { FilterOpts } from './types.js'

const createCondition = (
  propDef: PropDef | PropDefEdge,
  size: number,
  // TODO: this is tmp will become user operator
  operator: (typeof FilterOpInverse)[keyof typeof FilterOpInverse],
) => {
  const condition = new Uint8Array(size + FilterConditionByteSize)
  writeFilterCondition(
    condition,
    {
      op: FilterOp[operator],
      start: propDef.start || 0,
      prop: propDef.prop,
      alignOffset: 255,
    },
    0,
  )
  return condition
}

export const filter = (
  db: DbClient,
  def: QueryDefFilter,
  field: string,
  // TODO: this is tmp will become user operator
  operator?: (typeof FilterOpInverse)[keyof typeof FilterOpInverse],
  value?: any,
  opts?: FilterOpts,
) => {
  if (operator === undefined) {
    operator = FilterOpInverse[0]
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
        console.log('CONTINUE', path.slice(i + 1).join('.'))
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
    return def
  }

  if (operator === 'tester') {
    conditions.push(createCondition(propDef, 0, operator))
  } else if (propDef.typeIndex === PropType.uint32) {
    // make functions for this on a map writeType(typeIndex)
    if (value.length > 1) {
      const condition = createCondition(
        propDef,
        6 + value.length * 4 + 16,
        operator,
      )
      let i = FilterConditionByteSize
      writeUint16(condition, value.length, i)
      i += 6 // 4 Extra for alignment padding
      for (const v of value) {
        writeUint32(condition, v, i)
        i += 4
      }
      // Empty padding for SIMD
      for (let j = 0; j < 4; j++) {
        writeUint32(condition, value[0], i)
        i += 4
      }
      conditions.push(condition)
    } else {
      conditions.push(
        writeUint32(
          createCondition(propDef, 8, operator),
          value[0],
          FilterConditionByteSize + 4, // 4 Extra for alignment padding
        ),
      )
    }
  }
}

export const or = (
  db: DbClient,
  def: QueryDefFilter,
  field: string,
  operator?: (typeof FilterOpInverse)[keyof typeof FilterOpInverse],
  value?: any,
  opts?: FilterOpts,
) => {
  if (operator === undefined) {
    operator = FilterOpInverse[0]
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
