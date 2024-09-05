import { SchemaString } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser } from './props.js'

export const string = new PropParser<SchemaString>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'string') {
        throw Error(ERRORS.EXPECTED_STR)
      }
    },
  },
)
