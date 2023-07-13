import { Parser } from './types'
import { error, ParseError } from './error'
import { BasedSchemaFieldString, BasedSchemaFieldText } from '../types'

const validate = (
  path: (string | number)[],
  value: string,
  fieldSchema: BasedSchemaFieldText | BasedSchemaFieldString
) => {
  if (typeof value !== 'string') {
    throw error(path, ParseError.incorrectFormat)
  }
  if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
    throw error(path, ParseError.subceedsMinimum)
  }
  if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
    error(path, ParseError.exceedsMaximum)
  }
}

export const string: Parser<'string'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  validate(path, value, fieldSchema)
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}

export const text: Parser<'text'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  const valueType = typeof value
  if (target.$language && valueType === 'string') {
    validate(path, value, fieldSchema)
    handlers.collect({
      path,
      value: { [target.$language]: value },
      typeSchema,
      fieldSchema,
      target,
    })
    return
  }

  if (valueType !== 'object') {
    error(path, ParseError.incorrectFormat)
  }

  for (const key in value) {
    const newPath = [...path, key]

    if (typeof value[key] === 'object' && value[key].$delete === true) {
      handlers.collect({
        path: newPath,
        value: null,
        typeSchema,
        fieldSchema,
        target,
      })
      continue
    }

    validate(newPath, value[key], fieldSchema)

    handlers.collect({
      path: newPath,
      value: value[key],
      typeSchema,
      fieldSchema,
      target,
    })
  }
}
