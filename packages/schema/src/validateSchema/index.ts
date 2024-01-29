import { ParseError } from '../error.js'
import { BasedSchema, BasedSchemaPartial, languages } from '../types.js'

type Validatior<T> = {
  [P in keyof Required<T>]: {
    optional?: boolean
    validator?: (
      value: any,
      newSchema: BasedSchemaPartial,
      oldSchema: BasedSchema
    ) => true | number
  }
}

const basedSchemaValidator: Validatior<BasedSchema> = {
  language: {
    validator: (value) => {
      // language not supported
      if (!languages.includes(value)) {
        return ParseError.languageNotSupported
      }
      return true
    },
  },
  translations: {
    validator: (value, newSchema, oldSchema) => {
      // translations property needs to be an array
      if (!Array.isArray(value)) {
        return ParseError.incorrectFormat
      }
      const language = newSchema.language || oldSchema.language
      // translations property cannot include language value
      if (language && value.includes(language)) {
        return ParseError.invalidProperty
      }
      // language not supported
      return value.every((l: string) => languages.includes(l))
        ? true
        : ParseError.languageNotSupported
    },
    optional: true,
  },
  languageFallbacks: { optional: true },
  root: {},
  $defs: {},
  types: {},
  prefixToTypeMapping: {},
}

type ValidateSchemaError = { code: ParseError; path?: string[] }
export const validateSchema = async (
  newSchema: BasedSchemaPartial,
  oldSchema?: BasedSchema
): Promise<{ valid?: true; errors?: ValidateSchemaError[] }> => {
  const errors: ValidateSchemaError[] = []

  if (newSchema === null || typeof newSchema !== 'object') {
    errors.push({ code: ParseError.invalidSchemaFormat })
    return { errors }
  }

  for (const key in newSchema) {
    if (newSchema.hasOwnProperty(key)) {
      if (basedSchemaValidator[key]) {
        if (basedSchemaValidator[key].validator) {
          const result = basedSchemaValidator[key].validator(
            newSchema[key],
            newSchema,
            oldSchema
          )
          if (typeof result === 'number') {
            errors.push({ code: result, path: [key] })
          }
        }
      } else {
        errors.push({ code: ParseError.invalidProperty, path: [key] })
      }
    }
  }

  return errors.length ? { errors } : { valid: true }
}
