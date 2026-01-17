import { writeUint32 } from '../../../utils/uint8.js'
import {
  createFilterCondition,
  FilterOp,
  FilterOpInverse,
  PropType,
} from '../../../zigTsExports.js'
import { DbClient } from '../../index.js'
import { IntermediateByteCode, QueryDef } from '../types.js'
import { FilterOpts } from './types.js'

export const filter = (
  db: DbClient,
  def: QueryDef,
  field: string,
  operator: (typeof FilterOpInverse)[keyof typeof FilterOpInverse],
  value?: any,
  opts?: FilterOpts,
) => {
  let propDef = def.props![field]

  if (!propDef) {
    // nested prop find it
    // throw new Error(`Property ${field} not found`)
  }

  if (!propDef) {
    throw new Error(`Property ${field} in filter not found`)
  }

  const filter = def.filter

  const conditions: IntermediateByteCode[] =
    filter.conditions.get(propDef.prop) ??
    filter.conditions.set(propDef.prop, []).get(propDef.prop) ??
    [] // for typescript...

  if (value && !(value instanceof Array)) {
    value = [value]
  }

  const header = createFilterCondition({
    op: FilterOp[operator],
    propType: propDef.typeIndex,
    start: propDef.start || 0,
    repeat: value ? value.length : 0,
    alignOffset: 255,
  })

  console.log(header)

  conditions.push(header)

  if (value) {
    // handle all cases here (quite different for each type)
    if (propDef.typeIndex === PropType.uint32) {
      for (const v of value) {
        const value = new Uint8Array(4)
        writeUint32(value, v, 0)
        conditions.push(value)
      }
    }
  }
}
