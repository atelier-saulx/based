import { SchemaTimestamp } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser } from './props.js'

export const timestamp = new PropParser<SchemaTimestamp>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'number' && !(val instanceof Date)) {
        throw Error(ERRORS.EXPECTED_STR)
      }
    },
  },
)
