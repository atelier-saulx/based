import { deepEqual } from '@saulx/utils'
import { ParseError } from '../error.js'
import { BasedSchemaType } from '../types.js'
import { Validator } from './index.js'
import { mustBeBoolean, mustBeString, mustBeStringArray } from './utils.js'

export const basedSchemaTypeValidator: Validator<BasedSchemaType> = {
  directory: {
    validator: mustBeString,
    optional: true,
  },
  fields: {
    validator: (value, path, newSchema, oldSchema) => {
      if (!(typeof value === 'object' && !Array.isArray(value))) {
        return [
          {
            code: ParseError.incorrectFormat,
            path,
          },
        ]
      }
    },
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
          ? true
          : [{ code: ParseError.incorrectFormat, path }]
      }
      return /^[a-z]{2}$/.test(value)
        ? true
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
