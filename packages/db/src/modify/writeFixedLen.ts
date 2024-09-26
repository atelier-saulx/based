import { BasedDb } from '../index.js'
import { PropDef, PropDefEdge } from '../schema/types.js'

export const writeFixedLenValue = (
  db: BasedDb,
  value: any,
  pos: number,
  t: PropDef | PropDefEdge,
) => {
  // 11: string
  if (t.typeIndex === 11) {
    const size = db.modifyBuffer.buffer.write(value, pos + 1, 'utf8')
    db.modifyBuffer.buffer[pos] = size
    if (size + 1 > t.len) {
      console.warn('String does not fit fixed len', value)
      // also skip...
    }
    return
  }

  // 1: timestamp, 4: number
  if (t.typeIndex === 1 || t.typeIndex === 4) {
    db.modifyBuffer.buffer.writeFloatLE(value, pos)
    return
  }

  // 6: uint32
  if (t.typeIndex === 5) {
    db.modifyBuffer.buffer.writeUint32LE(value, pos)
    return
  }

  // 9: boolean
  if (t.typeIndex === 9) {
    db.modifyBuffer.buffer.writeInt8(value ? 1 : 0, pos)
    return
  }

  // 10: Enum
  if (t.typeIndex === 10) {
    const index = t.reverseEnum[value]
    if (index === undefined) {
      console.warn('invalid enum value')
      // skip
      db.modifyBuffer.buffer[pos] = 0
    } else {
      db.modifyBuffer.buffer[pos] = index + 1
    }
    return
  }
}
