import {
  PropDef,
  PropDefEdge,
  TIMESTAMP,
  CREATED,
  UPDATED,
  ENUM,
  BOOLEAN,
  STRING,
  BINARY,
  TEXT,
} from '@based/schema/def'
import { crc32 } from '../../crc32.js'
import { convertToTimestamp } from '../../timestamp.js'

const ENCODER = new TextEncoder()

// -------------------------------------------
// conditions normal
// field, [size 2]
// [or = 0] [size 2] [start 2], [op], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op], [size 2], value[size], [size 2], value[size]
// -------------------------------------------

export const parseFilterValue = (
  prop: PropDef | PropDefEdge,
  value: any,
): any => {
  if (
    prop.typeIndex === BINARY ||
    prop.typeIndex === STRING ||
    prop.typeIndex === TEXT
  ) {
    const b = value instanceof Uint8Array ? value : ENCODER.encode(value)
    const buf = new Uint8Array(8)
    let crc = crc32(b)
    buf[0] = crc
    buf[1] = crc >>>= 8
    buf[2] = crc >>>= 8
    buf[3] = crc >>>= 8
    let len = b.byteLength
    buf[4] = len
    buf[5] = len >>>= 8
    buf[6] = len >>>= 8
    buf[7] = len >>>= 8
    return buf
  } else if (prop.typeIndex === BOOLEAN) {
    return value ? 1 : 0
  } else if (prop.typeIndex === ENUM) {
    return prop.reverseEnum[value] + 1
  } else if (
    prop.typeIndex === TIMESTAMP ||
    prop.typeIndex === CREATED ||
    prop.typeIndex === UPDATED
  ) {
    const v = convertToTimestamp(value)
    if (typeof v !== 'number') {
      throw new Error(`Incorrect value for timestamp ${prop.path.join('.')}`)
    }
    return v
  }
  return value
}
