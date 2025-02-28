import {
  INT16,
  INT32,
  INT8,
  UINT16,
  UINT32,
  UINT8,
  NUMBER,
  TIMESTAMP,
  PropDef,
  PropDefEdge,
} from './types.js'

export const propIsSigned = (prop: PropDef | PropDefEdge): boolean => {
  const t = prop.typeIndex
  if (t === INT16 || t === INT32 || t === INT8) {
    return true
  }
  return false
}

export const propIsNumerical = (prop: PropDef | PropDefEdge) => {
  const t = prop.typeIndex
  if (
    t === INT16 ||
    t === INT32 ||
    t === INT8 ||
    t === UINT8 ||
    t === UINT16 ||
    t === UINT32 ||
    t === NUMBER ||
    t === TIMESTAMP
  ) {
    return true
  }
  return false
}
