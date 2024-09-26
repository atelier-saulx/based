import { BasedDb } from '../index.js'
import { PropDef, PropDefEdge } from '../schema/types.js'
import { modifyError, ModifyState } from './ModifyRes.js'

export const writeFixedLenValue = (
  db: BasedDb,
  value: any,
  pos: number,
  t: PropDef | PropDefEdge,
  res: ModifyState,
) => {
  // 11: string
  if (t.typeIndex === 11) {
    if (value === null) {
      value = ''
    } else if (typeof value !== 'string') {
      modifyError(res, t, value)
      return
    }
    const size = db.modifyBuffer.buffer.write(value, pos + 1, 'utf8')
    db.modifyBuffer.buffer[pos] = size
    if (size + 1 > t.len) {
      console.warn('String does not fit fixed len', value)
      // also skip...
    }
    return
  }

  // 9: boolean
  if (t.typeIndex === 9) {
    if (value === null) {
      value = false
    } else if (typeof value !== 'boolean') {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeInt8(value ? 1 : 0, pos)
    return
  }

  // 10: Enum
  if (t.typeIndex === 10) {
    if (value === null) {
      db.modifyBuffer.buffer[pos] = 1
      return
    }
    if (value in t.reverseEnum) {
      db.modifyBuffer.buffer[pos] = t.reverseEnum[value] + 1
      return
    }
    modifyError(res, t, value)
    return
  }

  // -----------------------ONLY NUMBERS HERE ON DOWN --------------------
  if (value === null) {
    value = 0
  } else if (typeof value !== 'number') {
    modifyError(res, t, value)
    return
  }

  // 1: timestamp, 4: number
  if (t.typeIndex === 1 || t.typeIndex === 4) {
    db.modifyBuffer.buffer.writeDoubleLE(value, pos)
    return
  }

  // 18: int8
  if (t.typeIndex === 18) {
    if (value < -128 || value > 127) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeInt8(value, pos)
    return
  }

  // 19: uint8
  if (t.typeIndex === 19) {
    if (value < 0 || value > 255) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeUint8(value, pos)
    return
  }

  // 20: int16
  if (t.typeIndex === 20) {
    if (value < -32_768 || value > 32_767) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeInt16LE(value, pos)
    return
  }

  // 21: uint16
  if (t.typeIndex === 21) {
    if (value < 0 || value > 65_535) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeUint16LE(value, pos)
    return
  }

  // 22: int32
  if (t.typeIndex === 22) {
    if (value < -2_147_483_648 || value > 2_147_483_647) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeInt32LE(value, pos)
    return
  }

  // 6: uint32
  if (t.typeIndex === 5) {
    if (value < 0 || value > 4_294_967_295) {
      modifyError(res, t, value)
      return
    }
    db.modifyBuffer.buffer.writeUint32LE(value, pos)
    return
  }

  // -----------------------ONLY NUMBERS ON THE END --------------------
}
