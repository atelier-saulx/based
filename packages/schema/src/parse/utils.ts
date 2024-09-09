import { INVALID_TYPE, MISSING_TYPE } from './errors.js'

export const getPropType = (prop) => {
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
    return 'set'
  }
  if ('enum' in prop) {
    return 'enum'
  }
  throw Error(MISSING_TYPE)
}
