import type { PropDef, PropDefEdge } from '@based/schema'
import { crc32 } from '../../crc32.js'
import { convertToTimestamp, ENCODER, writeUint32 } from '@based/utils'
import { PropType } from '../../../zigTsExports.js'
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
    prop.typeIndex === PropType.binary ||
    prop.typeIndex === PropType.string ||
    prop.typeIndex === PropType.text
  ) {
    const b = value instanceof Uint8Array ? value : ENCODER.encode(value)
    const buf = new Uint8Array(8)
    writeUint32(buf, crc32(b), 0)
    writeUint32(buf, b.byteLength, 4)
    return buf
  } else if (prop.typeIndex === PropType.boolean) {
    return value ? 1 : 0
  } else if (prop.typeIndex === PropType.enum) {
    return prop.reverseEnum[value] + 1
  } else if (prop.typeIndex === PropType.timestamp) {
    const v = convertToTimestamp(value)
    if (typeof v !== 'number') {
      throw new Error(`Incorrect value for timestamp ${prop.path.join('.')}`)
    }
    return v
  }
  return value
}
