import { BasedDb } from '../index.js'
import { SchemaTypeDef } from '../schema/types.js'
import { CREATE, ModifyOp } from './types.js'

export const setCursor = (
  db: BasedDb,
  schema: SchemaTypeDef,
  field: number,
  id: number,
  modifyOp: ModifyOp,
  ignoreField?: boolean,
) => {
  // 0 switch field
  // 1 switch id
  // 2 switch type
  const prefix0 = schema.idUint8[0]
  const prefix1 = schema.idUint8[1]
  const mod = db.modifyCtx

  if (mod.prefix0 !== prefix0 || mod.prefix1 !== prefix1) {
    // switch type
    mod.buffer[mod.len] = 2
    mod.buffer[mod.len + 1] = prefix0
    mod.buffer[mod.len + 2] = prefix1
    mod.len += 3
    mod.prefix0 = prefix0
    mod.prefix1 = prefix1
    mod.field = -1
    mod.id = -1
    mod.lastMain = -1
  }

  if (!ignoreField && mod.field !== field) {
    // switch field
    mod.buffer[mod.len] = 0
    // make field 2 bytes
    mod.buffer[mod.len + 1] = field // 1 byte (max size 255 - 1)
    mod.len += 2
    mod.field = field
  }

  if (mod.id !== id) {
    // switch node
    mod.hasStringField = -1
    mod.buffer[mod.len] = modifyOp === CREATE ? 9 : 1
    mod.buffer.writeUInt32LE(id, mod.len + 1)
    mod.len += 5
    mod.id = id
    mod.lastMain = -1
  }
}
