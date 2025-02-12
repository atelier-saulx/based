import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { negateType, OPERATOR, stripNegation } from './operators.js'

export const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  op: OPERATOR,
  value: any,
) => {
  let buf: Buffer
  const len = Array.isArray(value) ? value.length : 1
  buf = Buffer.allocUnsafe(11 + len * 8)
  buf[0] = negateType(op)
  buf[1] = 5
  buf.writeUInt16LE(8, 2)
  buf.writeUInt16LE(len, 4)
  buf[6] = stripNegation(op)
  buf[7] = prop.typeIndex
  buf[8] = 0
  buf.writeUInt16LE(prop.inverseTypeId, 9)
  if (Array.isArray(value)) {
    for (let i = 0; i < len; i++) {
      buf.writeUInt32LE(value[i], 11 + i * 8)
    }
  } else {
    buf.writeUInt32LE(value, 11)
  }
  return buf
}
