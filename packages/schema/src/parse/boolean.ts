import { SchemaBoolean } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser } from './props.js'

export const boolean = new PropParser<SchemaBoolean>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'boolean') {
        throw Error(ERRORS.EXPECTED_BOOL)
      }
    },
  },
)
