import { SchemaSet } from '../types.js'
import { ERRORS } from './errors.js'
import { propParsers } from './index.js'
import { PropParser, isNotObject, getPropType } from './props.js'

export const set = new PropParser<SchemaSet>(
  {
    items(items, _prop, schema) {
      if (isNotObject(items)) {
        throw Error(ERRORS.EXPECTED_OBJ)
      }
      const itemsType = getPropType(items)
      if (
        itemsType === 'string' ||
        itemsType === 'number' ||
        itemsType === 'reference' ||
        itemsType === 'timestamp' ||
        itemsType === 'boolean'
      ) {
        propParsers[itemsType].parse(items, schema)
      }
    },
  },
  {
    defaultValue(val, prop) {
      console.warn('TODO SET DEFAULT VALUE')
      // if (typeof val === 'object') {
      //   throwErr(ERRORS.EXPECTED_PRIMITIVE, prop, 'defaultValue')
      // }
    },
  },
)
