import { deepEqual } from '@saulx/utils'
import { ParseError } from '../error.js'
import { BasedSchemaType } from '../types.js'
import { Validator } from './index.js'
import { mustBeBoolean, mustBeString, mustBeStringArray } from './utils.js'
import { mustBeFields } from './fieldValidators.js'

export const basedSchemaTypeValidator: Validator<BasedSchemaType> = {
  directory: {
    validator: mustBeString,
    optional: true,
  },
  fields: {
    validator: mustBeFields,
  },
  title: {
    validator: mustBeString,
    optional: true,
  },
  description: {
    validator: mustBeString,
    optional: true,
  },
  prefix: {
    validator: (value, path) => {
      if (deepEqual(path, ['root', 'prefix'])) {
        return value === 'ro'
          ? []
          : [{ code: ParseError.incorrectFormat, path }]
      }
      return /^[a-z]{2}$/.test(value)
        ? []
        : [{ code: ParseError.incorrectFormat, path }]
    },
    optional: true,
  },
  examples: { optional: true },
  required: {
    validator: mustBeStringArray,
    optional: true,
  },
  $defs: { optional: true },
  $delete: {
    validator: mustBeBoolean,
    optional: true,
  },
}
