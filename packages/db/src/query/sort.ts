import { SchemaTypeDef } from '../schema/types.js'
import { Query } from './query.js'

export const createSortBuffer = (
  schema: SchemaTypeDef,
  field: string,
  order?: 'asc' | 'desc',
) => {
  const fieldDef = schema.props[field]
  if (!fieldDef) {
    console.warn('Query: No field def defined for', field)
    return this
  }

  if (order !== undefined && fieldDef.prop === 0) {
    const buf = Buffer.allocUnsafe(7)
    buf[0] = order === 'asc' ? 0 : 1
    buf[1] = 0
    buf[2] = fieldDef.typeIndex
    buf.writeUint16LE(fieldDef.start, 3)
    buf.writeUint16LE(fieldDef.len, 5)
    return buf
  }

  if (order !== undefined) {
    const buf = Buffer.allocUnsafe(3)
    buf[0] = order === 'asc' ? 0 : 1
    buf[1] = fieldDef.prop
    buf[2] = fieldDef.typeIndex
    return buf
  }

  if (fieldDef.prop === 0) {
    const buf = Buffer.allocUnsafe(6)
    buf[0] = 0
    buf[1] = fieldDef.typeIndex
    buf.writeUint16LE(fieldDef.start, 2)
    buf.writeUint16LE(fieldDef.len, 4)
    return buf
  }

  const buf = Buffer.allocUnsafe(2)
  buf[0] = fieldDef.prop
  buf[1] = fieldDef.typeIndex
  return buf
}

export const sort = (
  query: Query,
  field: string,
  order: 'asc' | 'desc' = 'asc',
) => {
  query.sortOrder = order === 'asc' ? 0 : 1
  query.sortBuffer = createSortBuffer(query.schema, field)
}
