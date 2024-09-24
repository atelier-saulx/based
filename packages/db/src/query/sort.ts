import { Query } from './query.js'

export const sort = (
  query: Query,
  field: string,
  order: 'asc' | 'desc' = 'asc',
) => {
  const fieldDef = query.schema.props[field]
  if (!fieldDef) {
    console.warn('Query: No field def defined for', field)
    return this
  }
  query.sortOrder = order === 'asc' ? 0 : 1
  if (fieldDef.prop === 0) {
    const buf = Buffer.allocUnsafe(6)
    buf[0] = 0
    buf[1] = fieldDef.typeIndex
    buf.writeUint16LE(fieldDef.start, 2)
    buf.writeUint16LE(fieldDef.len, 4)
    query.sortBuffer = buf
  } else {
    const buf = Buffer.allocUnsafe(2)
    buf[0] = fieldDef.prop
    buf[1] = fieldDef.typeIndex
    query.sortBuffer = buf
  }
}
