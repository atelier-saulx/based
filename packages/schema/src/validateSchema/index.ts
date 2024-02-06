import { ParseError } from '../error.js'
import {
  BasedSchema,
  BasedSchemaPartial,
  languages,
  BasedSchemaLanguage,
  BasedSchemaType,
} from '../types.js'
import { basedSchemaTypeValidator } from './basedSchemaTypeValidator.js'

export type ValidateSchemaError = { code: ParseError; path?: string[] }
export type Validator<T> = {
  [P in keyof Required<T>]: {
    optional?: boolean
    validator?: (
      value: any,
      path: string[],
      newSchema: BasedSchemaPartial,
      oldSchema: BasedSchema
    ) => ValidateSchemaError[]
  }
}

const basedSchemaValidator: Validator<BasedSchema> = {
  language: {
    validator: (value, path) =>
      // language not supported
      languages.includes(value)
        ? []
        : [{ code: ParseError.languageNotSupported, path }],
  },
  translations: {
    validator: (value, path, newSchema, oldSchema) => {
      // translations property needs to be an array
      if (!Array.isArray(value)) {
        return [{ code: ParseError.incorrectFormat, path }]
      }
      const language = newSchema.language || oldSchema.language
      // translations property cannot include language value
      if (language && value.includes(language)) {
        return [{ code: ParseError.invalidProperty, path }]
      }
      // language not supported
      return value.every((l: string) => languages.includes(l))
        ? []
        : [{ code: ParseError.languageNotSupported, path }]
    },
    optional: true,
  },
  languageFallbacks: {
    validator: (
      value: Record<BasedSchemaLanguage, BasedSchemaLanguage[]>,
      path,
      newSchema,
      oldSchema
    ) => {
      // languageFallbacks needs to be an object
      if (typeof value !== 'object' || Array.isArray(value)) {
        return [{ code: ParseError.incorrectFormat, path }]
      }
      const schemaLangs = [newSchema.language || oldSchema?.language].concat(
        newSchema.translations || oldSchema?.translations
      )
      for (const key in value) {
        // languageFallbacks keys must be a language or a translation
        if (!schemaLangs.includes(key as BasedSchemaLanguage)) {
          return [{ code: ParseError.noLanguageFound, path }]
        }
        // languageFallbacks language values need to be array
        if (!Array.isArray(value[key])) {
          return [{ code: ParseError.incorrectFormat, path }]
        }
        if (
          !value[key].every((l: BasedSchemaLanguage) => schemaLangs.includes(l))
        ) {
          return [{ code: ParseError.noLanguageFound, path }]
        }
      }
      return []
    },
    optional: true,
  },
  root: {
    validator: (value, path, newSchema, oldSchema) =>
      validate<BasedSchemaType>(
        basedSchemaTypeValidator,
        value,
        path,
        newSchema,
        oldSchema
      ),
  },
  $defs: {},
  types: {
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
          errors.push(
            ...validate<BasedSchemaType>(
              basedSchemaTypeValidator,
              value[key],
              path.concat(key),
              newSchema,
              oldSchema
            )
          )
        }
      }
      return errors
    },
  },
  // TODO:
  prefixToTypeMapping: {},
}

export const validate: <T>(
  validator: Validator<T>,
  target: T,
  path: string[],
  newSchema: BasedSchemaPartial,
  oldSchema: BasedSchema
) => ValidateSchemaError[] = (
  validator,
  target,
  path,
  newSchema,
  oldSchema
) => {
  const errors: ValidateSchemaError[] = []
  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      if (validator[key]) {
        if (validator[key].validator) {
          const result = validator[key].validator(
            target[key],
            path.concat(key),
            newSchema,
            oldSchema
          )
          errors.push(...result)
        }
      } else {
        errors.push({
          code: ParseError.invalidProperty,
          path: path.concat(key),
        })
      }
    }
  }
  return errors
}

export const validateSchema = async (
  newSchema: BasedSchemaPartial,
  oldSchema?: BasedSchema
): Promise<{ valid?: true; errors?: ValidateSchemaError[] }> => {
  const errors: ValidateSchemaError[] = []

  if (newSchema === null || typeof newSchema !== 'object') {
    errors.push({ code: ParseError.invalidSchemaFormat })
    return { errors }
  }

  errors.push(
    ...validate(basedSchemaValidator, newSchema, [], newSchema, oldSchema)
  )

  return errors.length ? { errors } : { valid: true }
}
