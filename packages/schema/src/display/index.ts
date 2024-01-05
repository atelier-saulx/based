import { BasedSchemaField } from '../types.js'
import timestampDisplay from './timestamp.js'
import numberDisplay from './number.js'
import stringDisplay from './string.js'

export const display = (
  value: string | number | void,
  field: BasedSchemaField
): string | number | void => {
  if (field.type === 'timestamp' && typeof value === 'number') {
    // @ts-ignore
    return timestampDisplay(value, field.display)
  }

  if (field.type === 'number' && typeof value === 'number') {
    // @ts-ignore
    return numberDisplay(value, field.display)
  }

  if (field.type === 'string' && typeof value === 'string') {
    // @ts-ignore
    return stringDisplay(value, field.display)
  }

  return value
}
