import { Parser } from './types'
import { deepEqual } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { error, ParseError } from './error'
import { parseValueAndDefault } from './parseDefaultAndValue'

export const cardinality: Parser<'cardinality'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  if (value && typeof value === 'object') {
    if (value.$default !== undefined) {
      error(path, ParseError.defaultNotSupported)
    }
    if (value.$value !== undefined) {
      value = hashObjectIgnoreKeyOrder(value.$value).toString(16)
    } else {
      value = hashObjectIgnoreKeyOrder(value).toString(16)
    }
  } else {
    value = hash(value).toString(16)
  }
  if (!noCollect) {
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  }
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
  if (
    await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      noCollect
    )
  ) {
    return
  }

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
  if (
    !(await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      noCollect
    ))
  ) {
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
  if (
    await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      noCollect
    )
  ) {
    return
  }

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
    error(path, ParseError.incorrectFormat)
  }
}
