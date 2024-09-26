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
  const includeOrder = order !== undefined
  const len = includeOrder ? 3 : 2
  if (fieldDef.prop === 0) {
    const buf = Buffer.allocUnsafe(len + 4)
    buf[0] = 0
    buf[1] = fieldDef.typeIndex
    if (includeOrder) {
      buf[2] = order === 'asc' ? 0 : 1
    }
    buf.writeUint16LE(fieldDef.start, len)
    buf.writeUint16LE(fieldDef.len, len + 2)
    return buf
  }
  const buf = Buffer.allocUnsafe(len)
  buf[0] = fieldDef.prop
  buf[1] = fieldDef.typeIndex
  if (includeOrder) {
    buf[2] = order === 'asc' ? 0 : 1
  }
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
