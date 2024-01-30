import { ParseError } from '../error.js'
import {
  BasedSchema,
  BasedSchemaPartial,
  languages,
  BasedSchemaLanguage,
  BasedSchemaType,
} from '../types.js'
import { basedSchemaTypeValidator } from './basedSchemaTypeValidator.js'

type ValidateSchemaError = { code: ParseError; path?: string[] }
export type Validator<T> = {
  [P in keyof Required<T>]: {
    optional?: boolean
    validator?: (
      value: any,
      path: string[],
      newSchema: BasedSchemaPartial,
      oldSchema: BasedSchema
    ) => true | ValidateSchemaError[]
  }
}

const basedSchemaValidator: Validator<BasedSchema> = {
  language: {
    validator: (value, path) => {
      // language not supported
      if (!languages.includes(value)) {
        return [{ code: ParseError.languageNotSupported, path }]
      }
      return true
    },
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
        ? true
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
      return true
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
  types: {},
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
  let errors: ValidateSchemaError[] = []
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
          if (result !== true) {
            errors = errors.concat(result)
          }
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
  let errors: ValidateSchemaError[] = []

  if (newSchema === null || typeof newSchema !== 'object') {
    errors.push({ code: ParseError.invalidSchemaFormat })
    return { errors }
  }

  // for (const key in newSchema) {
  //   if (newSchema.hasOwnProperty(key)) {
  //     if (basedSchemaValidator[key]) {
  //       if (basedSchemaValidator[key].validator) {
  //         const result = basedSchemaValidator[key].validator(
  //           newSchema[key],
  //           newSchema,
  //           oldSchema
  //         )
  //         if (typeof result === 'number') {
  //           errors.push({ code: result, path: [key] })
  //         }
  //       }
  //     } else {
  //       errors.push({ code: ParseError.invalidProperty, path: [key] })
  //     }
  //   }
  // }
  errors = errors.concat(
    validate(basedSchemaValidator, newSchema, [], newSchema, oldSchema)
  )

  return errors.length ? { errors } : { valid: true }
}
