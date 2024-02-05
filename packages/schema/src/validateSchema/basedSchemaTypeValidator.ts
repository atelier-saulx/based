import { deepEqual } from '@saulx/utils'
import { ParseError } from '../error.js'
import { BasedSchemaType } from '../types.js'
import { ValidateSchemaError, Validator, validate } from './index.js'
import { mustBeBoolean, mustBeString, mustBeStringArray } from './utils.js'
import { basedSchemaStringSharedValidator } from './basedSchemaStringValidator.js'
import { basedSchemaFieldSharedValidator } from './basedSchemaFieldValidator.js'

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
      const errors: ValidateSchemaError[] = []
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          switch (value[key].type) {
            case 'string':
              errors.push(
                ...validate(
                  {
                    ...basedSchemaStringSharedValidator,
                    ...basedSchemaFieldSharedValidator,
                  },
                  value[key],
                  path.concat(key),
                  newSchema,
                  oldSchema
                )
              )
              break

            default:
              break
          }
        }
      }
      return errors
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
