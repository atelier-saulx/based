import { Parser } from './types'
import { error, ParseError } from './error'

export const string: Parser<'string'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
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
    // @ts-ignore
    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      error(path, ParseError.subceedsMinimum)
    }
    // @ts-ignore
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      error(path, ParseError.exceedsMaximum)
    }

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
    // @ts-ignore
    if (fieldSchema.minLength && value[key].length < fieldSchema.minLength) {
      error([...path, key], ParseError.subceedsMinimum)
    }

    // @ts-ignore
    if (fieldSchema.maxLength && value[key].length > fieldSchema.maxLength) {
      error([...path, key], ParseError.exceedsMaximum)
    }

    if (typeof value[key] === 'object' && value[key].$delete === true) {
      handlers.collect({
        path: [...path, key],
        value: null,
        typeSchema,
        fieldSchema,
        target,
      })
      continue
    }

    if (typeof value[key] !== 'string') {
      error([...path, key], ParseError.incorrectFormat)
    }

    handlers.collect({
      path: [...path, key],
      value: value[key],
      typeSchema,
      fieldSchema,
      target,
    })
  }
}
