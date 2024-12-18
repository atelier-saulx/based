import { BasedDb } from '../../index.js'
import { DbServer } from '../index.js'
import {
  INT16,
  INT32,
  INT64,
  NUMBER,
  INT8,
  PropDef,
  PropDefEdge,
} from './types.js'

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
  const buf = Buffer.allocUnsafe(2)
  buf.writeUInt16LE(n)

  if (buf[1] == 255) {
    return genIdFromInt(n + 1)
  }

  if (buf[0] == 255) {
    return genIdFromInt(n + 1)
  }

  if (buf[1] == 0) {
    buf[1] = 255
  }

  if (buf[0] == 0) {
    buf[0] = 255
  }

  const cnt = buf.readUInt16LE()
  return cnt
}

export const genRootId = () => {
  return genIdFromInt(1)
}

export const genId = (db: DbServer): number => {
  db.schema.lastId++
  return genIdFromInt(db.schema.lastId)
}
