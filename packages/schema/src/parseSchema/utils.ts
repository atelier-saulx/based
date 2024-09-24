import { SchemaProp } from '../types.js'
import { INVALID_TYPE, MISSING_TYPE } from './errors.js'

export const getPropType = (prop: SchemaProp): SchemaProp['type'] => {
  if (prop.type) {
    if (typeof prop.type !== 'string') {
      throw Error(INVALID_TYPE)
    }
    return prop.type
  }
  if ('ref' in prop) {
    return 'reference'
  }
  if ('items' in prop) {
    // @ts-ignore TODO
    if (getPropType(prop.items) === 'reference') {
      return 'references'
    }
    return 'set'
  }
  if ('enum' in prop) {
    return 'enum'
  }
  if ('props' in prop) {
    return 'object'
  }
  throw Error(MISSING_TYPE)
}
