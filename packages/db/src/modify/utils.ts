import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef } from '../schema/types.js'
import { CREATE, ModifyOp } from './types.js'

export const setType = (db: BasedDb, def: SchemaTypeDef) => {
  const type0 = def.idUint8[0]
  const type1 = def.idUint8[1]
  const mod = db.modifyCtx
  const prefix0 = mod.prefix0
  const prefix1 = mod.prefix1

  if (prefix0 !== type0 || prefix1 !== type1) {
    mod.buffer[mod.len] = 2
    mod.buffer[mod.len + 1] = type0
    mod.buffer[mod.len + 2] = type1
    mod.len += 3
    mod.prefix0 = type0
    mod.prefix1 = type1
    // mod.field = -1
    // mod.id = -1
    mod.lastMain = -1
  }
}

export const setField = (db: BasedDb, field: number) => {
  const mod = db.modifyCtx
  // switch field
  mod.buffer[mod.len] = 0
  // make field 2 bytes
  mod.buffer[mod.len + 1] = field // 1 byte (max size 255 - 1)
  mod.len += 2
  mod.field = field
}

export const setId = (db: BasedDb, id: number, modifyOp: ModifyOp) => {
  const mod = db.modifyCtx
  const buf = mod.buffer
  let pos = mod.len
  // switch node
  mod.hasStringField = -1
  mod.id = id
  mod.lastMain = -1

  buf[pos++] = modifyOp === CREATE ? 9 : 1
  buf[pos++] = id
  buf[pos++] = id >>>= 8
  buf[pos++] = id >>>= 8
  buf[pos++] = id >>>= 8

  mod.len = pos
  // buf.writeUInt32LE(id, mod.len + 1)
}

export const maybeFlush = (db: BasedDb, requiredLen: number) => {
  const mod = db.modifyCtx
  if (mod.len + requiredLen > db.maxModifySize) {
    const { prefix0, prefix1, field, modifyOp, id } = mod

    flushBuffer(db)
    // restore everything
    // set type
    mod.buffer[mod.len] = 2
    mod.buffer[mod.len + 1] = prefix0
    mod.buffer[mod.len + 2] = prefix1
    mod.len += 3
    mod.prefix0 = prefix0
    mod.prefix1 = prefix1

    // set field
    mod.buffer[mod.len] = 0
    mod.buffer[mod.len + 1] = field // 1 byte (max size 255 - 1)
    mod.len += 2
    mod.field = field

    // set id
    mod.hasStringField = -1
    mod.buffer[mod.len] = modifyOp === CREATE ? 9 : 1
    mod.buffer.writeUInt32LE(id, mod.len + 1)
    mod.len += 5
    mod.id = id
    mod.lastMain = -1
  }
}
