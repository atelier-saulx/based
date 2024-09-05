import { SchemaNumber } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser } from './props.js'

export const number = new PropParser<SchemaNumber>(
  {
    min(val) {
      if (typeof val !== 'number') {
        throw Error(ERRORS.EXPECTED_NUM)
      }
    },
    max(val, prop) {
      if (typeof val !== 'number') {
        throw Error(ERRORS.EXPECTED_NUM)
      }
      if (prop.min > val) {
        throw Error(ERRORS.MIN_MAX)
      }
    },
    step(val) {
      if (typeof val !== 'number' && val !== 'any') {
        throw Error(ERRORS.INVALID_VALUE)
      }
    },
  },
  {
    defaultValue(val, prop) {
      if (typeof val !== 'number') {
        throw Error(ERRORS.EXPECTED_NUM)
      }
      if (val > prop.max || val < prop.min) {
        throw Error(ERRORS.OUT_OF_RANGE)
      }

      if (prop.step !== 'any') {
        const min =
          typeof prop.min !== 'number' || prop.min === Infinity ? 0 : prop.min
        const v = val - min

        if (~~(v / prop.step) * prop.step !== v) {
          throw Error(ERRORS.INVALID_VALUE)
        }
      }
    },
  },
)
