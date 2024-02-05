import { basedSchemaDisplayFormats } from '../display/string.js'
import { ParseError } from '../error.js'
import { BasedSchemaStringShared, basedSchemaFieldTypes } from '../types.js'
import { Validator } from './index.js'
import { mustBeBoolean, mustBeNumber, mustBeString } from './utils.js'

export const basedSchemaStringSharedValidator: Validator<BasedSchemaStringShared> =
  {
    minLength: {
      validator: mustBeNumber,
      optional: true,
    },
    maxLength: {
      validator: mustBeNumber,
      optional: true,
    },
    contentMediaEncoding: {
      validator: mustBeString,
      optional: true,
    },
    contentMediaType: {
      validator: (value, path) =>
        /^\w*\/\w*$/.test(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
    pattern: {
      validator: mustBeString,
      optional: true,
    },
    format: {
      validator: (value, path) =>
        basedSchemaFieldTypes.includes(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
    display: {
      validator: (value, path) =>
        basedSchemaDisplayFormats.includes(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
    multiline: {
      validator: mustBeBoolean,
      optional: true,
    },
  }
