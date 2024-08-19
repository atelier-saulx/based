import { Query } from './query.js'

export const sort = (
  query: Query,
  field: string,
  order: 'asc' | 'desc' = 'asc',
) => {
  const fieldDef = query.schema.fields[field]
  if (!fieldDef) {
    console.warn('Query: No field def defined for', field)
    return this
  }
  query.sortOrder = order === 'asc' ? 0 : 1
  if (fieldDef.field === 0) {
    const buf = Buffer.allocUnsafe(6)
    buf[0] = 0
    buf[1] = fieldDef.typeByte
    buf.writeUint16LE(fieldDef.start, 2)
    buf.writeUint16LE(fieldDef.len, 4)
    query.sortBuffer = buf
  } else {
    const buf = Buffer.allocUnsafe(2)
    buf[0] = fieldDef.field
    buf[1] = fieldDef.typeByte
    query.sortBuffer = buf
  }

  if (fieldDef.field === 0) {
    let sortIndex = query.db.sortIndexesMain.get(query.schema.prefixNumber)
    if (!sortIndex) {
      query.db.sortIndexesMain.set(query.schema.prefixNumber, new Set())
      sortIndex = query.db.sortIndexesMain.get(query.schema.prefixNumber)
    }
    if (!sortIndex.has(fieldDef.start)) {
      sortIndex.add(fieldDef.start)
    }
  } else {
    let sortIndex = query.db.sortIndexes.get(query.schema.prefixNumber)
    if (!sortIndex) {
      query.db.sortIndexes.set(query.schema.prefixNumber, new Set())
      sortIndex = query.db.sortIndexes.get(query.schema.prefixNumber)
    }
    if (!sortIndex.has(fieldDef.field)) {
      sortIndex.add(fieldDef.field)
    }
  }
}
