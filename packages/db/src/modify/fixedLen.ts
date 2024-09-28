import { BasedDb } from '../index.js'
import {
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
} from '../schema/types.js'
import { modifyError, ModifyState } from './ModifyRes.js'
export const writeFixedLenValue = (
  db: BasedDb,
  value: any,
  pos: number,
  propDef: PropDef | PropDefEdge,
  res: ModifyState,
) => {
  const type = propDef.typeIndex
  const buf = db.modifyBuffer.buffer
  if (type === STRING) {
    if (value === null) {
      value = ''
    } else if (typeof value !== 'string') {
      modifyError(res, propDef, value)
      return
    }
    const size = buf.write(value, pos + 1, 'utf8')
    if (size + 1 > propDef.len) {
      modifyError(res, propDef, value)
    } else {
      buf[pos] = size
    }
  } else if (type === BOOLEAN) {
    if (value === null) {
      buf[pos] = 0
    } else if (typeof value === 'boolean') {
      buf[pos] = value ? 1 : 0
    } else {
      modifyError(res, propDef, value)
    }
  } else if (type === ENUM) {
    if (value === null) {
      buf[pos] = 1
    } else if (value in propDef.reverseEnum) {
      buf[pos] = propDef.reverseEnum[value] + 1
    } else {
      modifyError(res, propDef, value)
    }
  } else {
    // numbers
    if (value === null) {
      value = 0
    } else if (typeof value !== 'number') {
      modifyError(res, propDef, value)
      return
    }

    if (type === TIMESTAMP || type === NUMBER) {
      buf.writeDoubleLE(value, pos)
    } else {
      buf[pos] = value
      if (type === INT8 || type === UINT8) return
      buf[++pos] = value >>>= 8
      if (type === INT16 || type === UINT16) return
      buf[++pos] = value >>>= 8
      buf[++pos] = value >>>= 8
    }
  }
}
