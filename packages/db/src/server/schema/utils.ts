import { DbClient } from '../../client/index.js'
import { DbServer } from '../index.js'
import {
  INT16,
  INT32,
  INT64,
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
  if (t === INT16 || t === INT32 || t === INT64 || t === INT8) {
    return true
  }
  return false
}

export const propIsNumerical = (prop: PropDef | PropDefEdge) => {
  const t = prop.typeIndex
  if (
    t === INT16 ||
    t === INT32 ||
    t === INT64 ||
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

const genIdFromInt = (n: number): number => {
  return n
}

export const genRootId = () => {
  return genIdFromInt(1)
}

export const genId = (db: DbServer | DbClient): number => {
  db.schema.lastId++
  return genIdFromInt(db.schema.lastId)
}
