import { ParseError } from '../error.js'
import { BasedSchema, BasedSchemaPartial, languages } from '../types.js'

type Validatior<T> = {
  [P in keyof Required<T>]: {
    optional?: boolean
    validator?: (value: any) => true | number
  }
}

const basedSchemaValidator: Validatior<BasedSchema> = {
  language: {
    validator: (value) => {
      if (!languages.includes(value)) {
        return ParseError.languageNotSupported
      }
      return true
    },
  },
  translations: {
    validator: (value) => {
      if (!Array.isArray(value)) {
        return ParseError.incorrectFormat
      }
      value.forEach((l: string) => {
        if (!languages.includes(l)) {
          return ParseError.languageNotSupported
        }
      })
      return true
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
  newSchema: BasedSchemaPartial
  // oldSchema?: BasedSchemaPartial
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
          const result = basedSchemaValidator[key].validator(newSchema[key])
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
