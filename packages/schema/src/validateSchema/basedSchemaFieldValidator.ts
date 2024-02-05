import { ParseError } from '../error.js'
import { BasedSchemaFieldShared, basedSchemaFieldTypes } from '../types.js'
import { ValidateSchemaError, Validator } from './index.js'
import { mustBeBoolean, mustBeNumber, mustBeString } from './utils.js'

export const basedSchemaFieldSharedValidator: Validator<BasedSchemaFieldShared> =
  {
    type: {
      validator: (value, path) =>
        basedSchemaFieldTypes.includes(value)
          ? []
          : [{ code: ParseError.incorrectFieldType, path }],
    },
    hooks: {
      validator: (value, path) => {
        if (typeof value !== 'object') {
          return [{ code: ParseError.incorrectFormat, path }]
        }
        const items = Array.isArray(value) ? value : [{ ...value }]
        const errors: ValidateSchemaError[] = []
        items.forEach((item, index) => {
          if (item.hook) {
            errors.push(
              ...mustBeString(
                item.hook,
                path.concat(Array.isArray(value) ? String(index) : [], 'hook')
              )
            )
          }
          if (item.interval) {
            errors.push(
              ...mustBeNumber(
                item.interval,
                path.concat(
                  Array.isArray(value) ? String(index) : [],
                  'interval'
                )
              )
            )
          }
        })
        return errors
      },
      optional: true,
    },
    $id: {
      validator: mustBeString,
      optional: true,
    },
    isRequired: {
      validator: mustBeBoolean,
      optional: true,
    },
    $schema: {
      validator: mustBeString,
      optional: true,
    },
    title: {
      validator: mustBeString,
      optional: true,
    },
    description: {
      validator: mustBeString,
      optional: true,
    },
    index: {
      validator: mustBeNumber,
      optional: true,
    },
    readOnly: {
      validator: mustBeBoolean,
      optional: true,
    },
    writeOnly: {
      validator: mustBeBoolean,
      optional: true,
    },
    $comment: {
      validator: mustBeString,
      optional: true,
    },
    examples: { optional: true },
    default: { optional: true },
    customValidator: { optional: true },
    $defs: { optional: true },
    $delete: {
      validator: mustBeBoolean,
      optional: true,
    },
  }
