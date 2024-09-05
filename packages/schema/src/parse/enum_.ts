import { SchemaEnum, SchemaSet } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser } from './props.js'

export const enum_ = new PropParser<SchemaEnum>(
  {
    enum(items) {
      if (!Array.isArray(items)) {
        throw Error(ERRORS.EXPECTED_ARR)
      }
      for (const item of items) {
        if (typeof item === 'object') {
          throw Error(ERRORS.EXPECTED_PRIMITIVE)
        }
      }
    },
  },
  {
    defaultValue(val, prop) {
      if (!prop.enum.includes(val)) {
        throw Error(ERRORS.EXPECTED_VALUE_IN_ENUM)
      }
    },
  },
)
