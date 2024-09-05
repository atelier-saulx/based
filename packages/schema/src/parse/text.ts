import { SchemaText } from '../types.js'
import { PropParser } from './props.js'

export const text = new PropParser<SchemaText>(
  {},
  {
    defaultValue(val, prop) {
      console.warn('MAKE DEFAULT VALUE FOR TEXT')
      //   if (typeof val !== 'string') {
      //     throwErr(ERRORS.EXPECTED_STR, prop, 'defaultValue')
      //   }
    },
  },
)
