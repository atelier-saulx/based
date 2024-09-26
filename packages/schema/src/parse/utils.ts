import { SchemaAnyProp, SchemaProp, SchemaPropTypes } from '../types.js'
import { INVALID_TYPE, MISSING_TYPE } from './errors.js'

export const getPropType = (prop: SchemaAnyProp): SchemaPropTypes => {
  if (typeof prop === 'string') {
    return prop
  }

  if ('type' in prop) {
    if (typeof prop.type !== 'string') {
      throw Error(INVALID_TYPE)
    }
    return prop.type
  }

  if ('ref' in prop) {
    return 'reference'
  }

  if ('items' in prop) {
    if (getPropType(prop.items) === 'reference') {
      return 'references'
    }
    return 'set'
  }

  if ('props' in prop) {
    return 'object'
  }

  if ('enum' in prop || Array.isArray(prop)) {
    return 'enum'
  }

  throw Error(MISSING_TYPE)
}
