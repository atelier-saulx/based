import { deepEqual } from '@saulx/utils'
import { ParseError } from '../error.js'
import { BasedSchemaType } from '../types.js'
import { Validator } from './index.js'

const mustBeString = (value: string, path: string[]) =>
  typeof value === 'string'
    ? true
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

const mustBeStringArray = (value: string[], path: string[]) =>
  Array.isArray(value) && value.every((i) => typeof i === 'string')
    ? true
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

const mustBeBoolean = (value: string, path: string[]) =>
  typeof value === 'boolean'
    ? true
    : [
        {
          code: ParseError.incorrectFormat,
          path,
        },
      ]

export const basedSchemaTypeValidator: Validator<BasedSchemaType> = {
  directory: {
    validator: mustBeString,
    optional: true,
  },
  fields: {},
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
