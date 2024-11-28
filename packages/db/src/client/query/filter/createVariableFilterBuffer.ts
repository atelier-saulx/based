import { PropDef, PropDefEdge, STRING } from '../../../server/schema/types.js'
import { compress, crc32 } from '../../string.js'
import { negateType, stripNegation } from './operators.js'
import {
  createFixedFilterBuffer,
  writeFixed,
} from './createFixedFilterBuffer.js'

export const createVariableFilterBuffer = (
  value: any,
  prop: PropDef | PropDefEdge,
  op: number,
  buf: Buffer,
) => {
  let val = value
  if (val instanceof Uint8Array) {
    val = Buffer.from(val)
  } else if (prop.typeIndex === STRING && typeof value === 'string') {
    val = compress(value)
  }
  if (!(val instanceof Buffer)) {
    throw new Error('Incorrect value for filter ' + prop.path)
  }
  // --------------------
  if (op === 3 || op === 1 || op === 2 || op === 16) {
    if (prop.separate) {
      if (op === 1 && val.byteLength > 25) {
        buf = createFixedFilterBuffer(prop, 4, 17, crc32(val), false)
        buf = Buffer.allocUnsafe(16)
        buf[0] = negateType(op)
        buf[1] = 0 // 0: default
        buf.writeUInt16LE(8, 2)
        buf.writeUInt16LE(0, 4)
        buf[6] = 17
        buf[7] = prop.typeIndex
        writeFixed(prop, buf, crc32(val), 4, 8, 17)
        writeFixed(prop, buf, val.byteLength, 4, 12, 17)
      } else {
        const size = val.byteLength
        buf = Buffer.allocUnsafe(8 + size)
        buf[0] = negateType(op)
        buf[1] = 4
        buf.writeUint32LE(size, 2)
        buf[6] = stripNegation(op)
        buf[7] = prop.typeIndex
        buf.set(val, 8)
      }
    } else {
      const size = val.byteLength
      buf = Buffer.allocUnsafe(10 + size)
      buf[0] = negateType(op)
      buf[1] = 4 // 4: var size
      buf.writeUInt16LE(prop.start, 2)
      buf.writeUint32LE(size, 4)
      buf[8] = stripNegation(op)
      buf[9] = prop.typeIndex
      if (val.byteLength > prop.len) {
        throw new Error('filter is larger then max value')
      }
      buf.set(val, 10)
    }
  } else {
    console.log('SNURP', op)
  }
  return buf
}
