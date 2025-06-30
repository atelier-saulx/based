import { SchemaAnyProp, SchemaProps, SchemaPropTypes } from '../types.js'
import { INVALID_TYPE, MISSING_TYPE } from './errors.js'

export const getPropType = (
  prop: SchemaAnyProp,
  props?: SchemaProps,
  key?: string,
): SchemaPropTypes => {
  if (typeof prop === 'string') {
    if (props) {
      props[key] = { type: prop }
    }
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

  if ('enum' in prop) {
    return 'enum'
  }

  if (Array.isArray(prop)) {
    if (props) {
      props[key] = { enum: prop }
    }
    return 'enum'
  }

  throw Error(MISSING_TYPE)
}
