import { PropDefEdge } from '../../../../dist/schema.js'
import { PropDef } from '../../../schema.js'
import { writeUint16, writeUint32 } from '../../../utils/uint8.js'
import {
  FilterConditionByteSize,
  FilterOp,
  FilterOpInverse,
  PropType,
  writeFilterCondition,
} from '../../../zigTsExports.js'
import { DbClient } from '../../index.js'
import { QueryDef, QueryDefFilter } from '../types.js'
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
  filter: QueryDefFilter,
  field: string,
  // TODO: this is tmp will become user operator
  operator: (typeof FilterOpInverse)[keyof typeof FilterOpInverse],
  value?: any,
  opts?: FilterOpts,
) => {
  let propDef = filter.schema?.props![field]

  if (!propDef) {
    // nested prop find it
    // throw new Error(`Property ${field} not found`)
  }

  if (!propDef) {
    throw new Error(`Property ${field} in filter not found`)
  }

  const conditions =
    filter.conditions.get(propDef.prop) ??
    filter.conditions.set(propDef.prop, []).get(propDef.prop) ??
    [] // for typescript...

  if (value !== undefined && !(value instanceof Array)) {
    value = [value]
  }

  // for now
  if (value == undefined) {
    return
  }

  if (propDef.typeIndex === PropType.uint32) {
    // 4 Extra for alignment padding
    if (value.length > 1) {
      const condition = createCondition(propDef, 6 + value.length * 4, operator)
      let i = FilterConditionByteSize
      writeUint16(condition, value.length, 0)
      i += 6
      for (const v of value) {
        writeUint32(condition, v, i)
        i += 4
      }
      conditions.push(condition)
    } else {
      conditions.push(
        writeUint32(
          createCondition(propDef, 8, operator),
          value[0],
          FilterConditionByteSize + 4,
        ),
      )
    }
  }
}
