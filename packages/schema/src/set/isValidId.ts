import { BasedSchema } from '../types'

export const isValidId = (schema: BasedSchema, id: any): boolean => {
  if (typeof id !== 'string') {
    return false
  }

  if (id === 'root') {
    return true
  }

  if (id.length > 10) {
    return false
  }

  const prefix = id.slice(0, 2)

  if (!schema.prefixToTypeMapping[prefix]) {
    return false
  }

  return true
}
