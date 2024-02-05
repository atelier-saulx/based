import { basedSchemaNumberFormats } from '../display/number.js'
import { basedSchemaDisplayFormats } from '../display/string.js'
import { basedSchemaDateFormats } from '../display/timestamp.js'
import { ParseError } from '../error.js'
import {
  BasedSchema,
  BasedSchemaFieldAny,
  BasedSchemaFieldArray,
  BasedSchemaFieldBoolean,
  BasedSchemaFieldCardinality,
  BasedSchemaFieldEnum,
  BasedSchemaFieldInteger,
  BasedSchemaFieldJSON,
  BasedSchemaFieldNumber,
  BasedSchemaFieldObject,
  BasedSchemaFieldRecord,
  BasedSchemaFieldReference,
  BasedSchemaFieldReferences,
  BasedSchemaFieldSet,
  BasedSchemaFieldShared,
  BasedSchemaFieldString,
  BasedSchemaFieldText,
  BasedSchemaFieldTimeStamp,
  BasedSchemaNumberDefaults,
  BasedSchemaPartial,
  BasedSchemaStringShared,
  basedSchemaFieldTypes,
  languages,
} from '../types.js'
import { ValidateSchemaError, Validator, validate } from './index.js'
import {
  mustBeBidirectional,
  mustBeBoolean,
  mustBeNumber,
  mustBeString,
  mustBeStringArray,
} from './utils.js'

type MustBeFieldOptions = {
  limitTo?: 'primitives' | 'enumerables'
}
export const mustBeField = (
  value: any,
  path: string[],
  newSchema: BasedSchemaPartial,
  oldSchema: BasedSchema,
  options?: MustBeFieldOptions
) => {
  if (!(typeof value === 'object' && !Array.isArray(value))) {
    return [
      {
        code: ParseError.incorrectFormat,
        path,
      },
    ]
  }
  const type = value.type
  if (
    (options?.limitTo === 'primitives' &&
      ![
        'string',
        'number',
        'integer',
        'timestamp',
        'json',
        'boolean',
        'enum',
      ].includes(type)) ||
    (options?.limitTo === 'enumerables' &&
      !['text', 'object', 'record', 'array', 'set'].includes(type))
  ) {
    return [
      {
        code: ParseError.incorrectFormat,
        path: path.concat('type'),
      },
    ]
  }
  let validator: Validator<unknown>
  switch (type) {
    case 'string':
      validator = basedSchemaStringValidator
      break
    case 'enum':
      validator = basedSchemaFieldEnumValidator
      break
    case 'cardinality':
      validator = basedSchemaFieldCardinalityValidator
      break
    case 'number':
      validator = basedSchemaFieldNumberValidator
      break
    case 'integer':
      validator = basedSchemaFieldIntegerValidator
      break
    case 'timestamp':
      validator = basedSchemaFieldTimeStampValidator
      break
    case 'boolean':
      validator = basedSchemaFieldBooleanValidator
      break
    case 'json':
      validator = basedSchemaFieldJSONValidator
      break
    case 'text':
      validator = basedSchemaFieldTextValidator
      break
    case 'object':
      validator = basedSchemaFieldObjectValidator
      break
    case 'record':
      validator = basedSchemaFieldRecordValidator
      break
    case 'array':
      validator = basedSchemaFieldArrayValidator
      break
    case 'set':
      validator = basedSchemaFieldSetValidator
      break
    default:
      validator = basedSchemaFieldSharedValidator
      break
  }
  return validate(validator, value, path, newSchema, oldSchema)
}

export const mustBeFields = (
  value: any,
  path: string[],
  newSchema: BasedSchemaPartial,
  oldSchema: BasedSchema
) => {
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
      errors.push(
        ...mustBeField(value[key], path.concat(key), newSchema, oldSchema)
      )
    }
  }
  return errors
}

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
        /^\w+\/\w+$/.test(value)
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

export const basedSchemaStringValidator: Validator<BasedSchemaFieldString> = {
  ...basedSchemaFieldSharedValidator,
  ...basedSchemaStringSharedValidator,
}

export const basedSchemaFieldEnumValidator: Validator<BasedSchemaFieldEnum> = {
  ...basedSchemaFieldSharedValidator,
  enum: {},
}

export const basedSchemaFieldCardinalityValidator: Validator<BasedSchemaFieldCardinality> =
  {
    ...basedSchemaFieldSharedValidator,
  }

export const basedSchemaNumberDefaultsValidator: Validator<BasedSchemaNumberDefaults> =
  {
    multipleOf: {
      validator: mustBeNumber,
      optional: true,
    },
    minimum: {
      validator: mustBeNumber,
      optional: true,
    },
    maximum: {
      validator: mustBeNumber,
      optional: true,
    },
    exclusiveMaximum: {
      validator: mustBeBoolean,
      optional: true,
    },
    exclusiveMinimum: {
      validator: mustBeBoolean,
      optional: true,
    },
  }

export const basedSchemaFieldNumberValidator: Validator<BasedSchemaFieldNumber> =
  {
    ...basedSchemaFieldSharedValidator,
    ...basedSchemaNumberDefaultsValidator,
    display: {
      validator: (value, path) =>
        basedSchemaNumberFormats.includes(value) || /^round-\d+$/.test(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
  }

export const basedSchemaFieldIntegerValidator: Validator<BasedSchemaFieldInteger> =
  {
    ...basedSchemaFieldSharedValidator,
    ...basedSchemaNumberDefaultsValidator,
    display: {
      validator: (value, path) =>
        basedSchemaNumberFormats.includes(value) || /^round-\d+$/.test(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
  }

export const basedSchemaFieldTimeStampValidator: Validator<BasedSchemaFieldTimeStamp> =
  {
    ...basedSchemaFieldSharedValidator,
    ...basedSchemaNumberDefaultsValidator,
    display: {
      validator: (value, path) =>
        basedSchemaDateFormats.includes(value)
          ? []
          : [{ code: ParseError.incorrectFormat, path }],
      optional: true,
    },
  }

export const basedSchemaFieldBooleanValidator: Validator<BasedSchemaFieldBoolean> =
  {
    ...basedSchemaFieldSharedValidator,
  }

export const basedSchemaFieldJSONValidator: Validator<BasedSchemaFieldJSON> = {
  ...basedSchemaFieldSharedValidator,
  format: {
    validator: (value, path) =>
      value === 'rich-text' ? [] : [{ code: ParseError.incorrectFormat, path }],
    optional: true,
  },
}

export const basedSchemaFieldAnyValidator: Validator<BasedSchemaFieldAny> = {
  ...basedSchemaFieldSharedValidator,
}

export const basedSchemaFieldTextValidator: Validator<BasedSchemaFieldText> = {
  ...basedSchemaFieldSharedValidator,
  ...basedSchemaStringSharedValidator,
  required: {
    validator: (value, path) =>
      Array.isArray(value) &&
      value.every((i) => Object.keys(languages).includes(i))
        ? []
        : [{ code: ParseError.languageNotSupported, path }],
    optional: true,
  },
}

export const basedSchemaFieldObjectValidator: Validator<BasedSchemaFieldObject> =
  {
    ...basedSchemaFieldSharedValidator,
    properties: {
      validator: mustBeFields,
    },
    required: {
      validator: mustBeStringArray,
      optional: true,
    },
  }

export const basedSchemaFieldRecordValidator: Validator<BasedSchemaFieldRecord> =
  {
    ...basedSchemaFieldSharedValidator,
    values: {
      validator: mustBeField,
    },
  }

export const basedSchemaFieldArrayValidator: Validator<BasedSchemaFieldArray> =
  {
    ...basedSchemaFieldSharedValidator,
    values: {
      validator: mustBeField,
    },
  }

export const basedSchemaFieldSetValidator: Validator<BasedSchemaFieldSet> = {
  ...basedSchemaFieldSharedValidator,
  items: {
    validator: (
      value: string,
      path: string[],
      newSchema: BasedSchemaPartial,
      oldSchema: BasedSchema
    ) =>
      mustBeField(value, path, newSchema, oldSchema, { limitTo: 'primitives' }),
  },
}

export const basedSchemaFieldReferenceValidator: Validator<BasedSchemaFieldReference> =
  {
    ...basedSchemaFieldSharedValidator,
    bidirectional: {
      validator: mustBeBidirectional,
      optional: true,
    },
    allowedTypes: {
      // TODO: validator
      optional: true,
    },
  }

export const basedSchemaFieldReferencesValidator: Validator<BasedSchemaFieldReferences> =
  {
    ...basedSchemaFieldSharedValidator,
    bidirectional: {
      validator: mustBeBidirectional,
      optional: true,
    },
    allowedTypes: {
      // TODO: validator
      optional: true,
    },
    sortable: {
      validator: mustBeBoolean,
      optional: true,
    },
  }
