import { DbServer } from '../index.js'
import { INT16, INT32, INT64, INT8, PropDef, PropDefEdge } from './types.js'

export const propIsSigned = (prop: PropDef | PropDefEdge): boolean => {
  if (
    prop.typeIndex === INT16 ||
    prop.typeIndex === INT32 ||
    prop.typeIndex === INT64 ||
    prop.typeIndex === INT8
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

export const genId = (db: DbServer): number => {
  db.schema.lastId++
  return genIdFromInt(db.schema.lastId)
}
