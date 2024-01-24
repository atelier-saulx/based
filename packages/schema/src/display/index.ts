import { BasedSchemaField } from '../types.js'
import timestampDisplay from './timestamp.js'
import numberDisplay from './number.js'
import stringDisplay from './string.js'

export const display = (
  value: string | number | undefined,
  field: BasedSchemaField
): string | number | undefined => {
  if (field.type === 'timestamp' && typeof value === 'number') {
    return timestampDisplay(value, field.display)
  }
  if (field.type === 'number' && typeof value === 'number') {
    return numberDisplay(value, field.display)
  }
  if (field.type === 'string' && typeof value === 'string') {
    return stringDisplay(value, field.display)
  }
  return value
}
