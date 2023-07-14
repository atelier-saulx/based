import { Parser } from './types'
import { deepEqual } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { error, ParseError } from './error'

export const cardinality: Parser<'cardinality'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  if (value && typeof value === 'object') {
    value = hashObjectIgnoreKeyOrder(value).toString(16)
  } else {
    value = hash(value).toString(16)
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}

export const boolean: Parser<'boolean'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  if (typeof value !== 'boolean') {
    error(path, ParseError.incorrectFormat)
  }
  if (!noCollect) {
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  }
}

export const enumParser: Parser<'enum'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  const enumValues = fieldSchema.enum
  for (let i = 0; i < enumValues.length; i++) {
    if (deepEqual(enumValues[i], value)) {
      if (!noCollect) {
        handlers.collect({ path, value: i, typeSchema, fieldSchema, target })
      }
      return
    }
  }
  error(path, ParseError.incorrectFormat)
}

export const json: Parser<'json'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  try {
    const parsedValue = JSON.stringify(value)
    if (!noCollect) {
      handlers.collect({
        path,
        value: parsedValue,
        typeSchema,
        fieldSchema,
        target,
      })
    }
  } catch (err) {
    throw err(path, ParseError.incorrectFormat)
  }
}
