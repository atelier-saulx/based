import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef } from '../schema/types.js'
import { CREATE, ModifyOp } from './types.js'

const _initType = (ctx, type0: number, type1: number) => {
  ctx.buffer[ctx.len] = 2
  ctx.buffer[ctx.len + 1] = type0
  ctx.buffer[ctx.len + 2] = type1
  ctx.len += 3
  ctx.prefix0 = type0
  ctx.prefix1 = type1
  ctx.lastMain = -1
}

export const initType = (db: BasedDb, def: SchemaTypeDef) => {
  const type0 = def.idUint8[0]
  const type1 = def.idUint8[1]
  const ctx = db.modifyCtx
  const prefix0 = ctx.prefix0
  const prefix1 = ctx.prefix1

  if (prefix0 !== type0 || prefix1 !== type1) {
    _initType(ctx, type0, type1)
  }
}

export const initField = (db: BasedDb, field: number) => {
  const ctx = db.modifyCtx
  const buf = ctx.buffer

  buf[ctx.len] = 0
  buf[ctx.len + 1] = field // 1 byte (max size 255 - 1)// TODO make field 2 bytes
  ctx.len += 2
  ctx.field = field
}

export const initId = (db: BasedDb, id: number, modifyOp: ModifyOp) => {
  const ctx = db.modifyCtx
  const buf = ctx.buffer
  let pos = ctx.len
  // switch node
  ctx.hasStringField = -1
  ctx.id = id
  ctx.lastMain = -1

  buf[pos++] = modifyOp === CREATE ? 9 : 1
  buf[pos++] = id
  buf[pos++] = id >>>= 8
  buf[pos++] = id >>>= 8
  buf[pos++] = id >>>= 8
  ctx.len = pos
}

export const maybeFlush = (db: BasedDb, requiredLen: number) => {
  const ctx = db.modifyCtx
  if (ctx.len + requiredLen > db.maxModifySize) {
    const { prefix0, prefix1, field, modifyOp, id } = ctx
    // flush
    flushBuffer(db)
    // restore
    _initType(ctx, prefix0, prefix1)
    initField(db, field)
    initId(db, id, modifyOp)
    // continue
  }
}
