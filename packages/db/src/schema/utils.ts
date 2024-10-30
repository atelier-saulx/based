import { BasedDb } from '../index.js'
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

export const genId = (db: BasedDb): number => {
  db.schema.lastId++

  const buf = Buffer.allocUnsafe(2)

  buf.writeUInt16LE(db.schema.lastId)

  // console.log(new Uint8Array(buf))

  if (buf[1] == 255) {
    return genId(db)
  }

  if (buf[0] == 255) {
    return genId(db)
  }

  if (buf[1] == 0) {
    buf[1] = 255
  }

  if (buf[0] == 0) {
    buf[0] = 255
  }

  const cnt = buf.readUInt16LE()

  // console.log({ cnt })

  return cnt
}
