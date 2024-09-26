import { BasedDb } from '../index.js'
import { SchemaTypeDef } from '../schema/types.js'

export const setCursor = (
  db: BasedDb,
  schema: SchemaTypeDef,
  field: number,
  id: number,
  ignoreField?: boolean,
  isCreate?: boolean,
) => {
  // 0 switch field
  // 1 switch id
  // 2 switch type
  const prefix = schema.idUint8
  if (
    db.modifyBuffer.typePrefix[0] !== prefix[0] ||
    db.modifyBuffer.typePrefix[1] !== prefix[1]
  ) {
    const len = db.modifyBuffer.len
    db.modifyBuffer.buffer[len] = 2
    db.modifyBuffer.buffer[len + 1] = prefix[0]
    db.modifyBuffer.buffer[len + 2] = prefix[1]
    db.modifyBuffer.len += 3
    db.modifyBuffer.typePrefix = prefix
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
  }

  if (!ignoreField && db.modifyBuffer.field !== field) {
    const len = db.modifyBuffer.len
    db.modifyBuffer.buffer[len] = 0
    // make field 2 bytes
    db.modifyBuffer.buffer[len + 1] = field // 1 byte (max size 255 - 1)
    db.modifyBuffer.len += 2
    db.modifyBuffer.field = field
  }

  if (db.modifyBuffer.id !== id) {
    db.modifyBuffer.hasStringField = -1
    const len = db.modifyBuffer.len
    // --- hello
    db.modifyBuffer.buffer[len] = isCreate ? 9 : 1
    db.modifyBuffer.buffer.writeUInt32LE(id, len + 1)
    db.modifyBuffer.len += 5
    db.modifyBuffer.id = id
    db.modifyBuffer.lastMain = -1
  }
}
