import { getPropType } from '../parse/utils.js'
import { SchemaProp, isPropType } from '../types.js'
import { SIZE_MAP } from './types.js'

export function getPropLen(schemaProp: SchemaProp) {
  let len = SIZE_MAP[getPropType(schemaProp)]
  if (
    isPropType('string', schemaProp) ||
    isPropType('alias', schemaProp) ||
    isPropType('cardinality', schemaProp)
  ) {
    if (typeof schemaProp === 'object') {
      if (schemaProp.maxBytes < 61) {
        len = schemaProp.maxBytes + 1
      } else if ('max' in schemaProp && schemaProp.max < 31) {
        len = schemaProp.max * 2 + 1
      }
    }
  } else if (isPropType('vector', schemaProp)) {
    len = 4 * schemaProp.size
  } else if (isPropType('colvec', schemaProp)) {
    len = schemaProp.size
  }
  return len
}
