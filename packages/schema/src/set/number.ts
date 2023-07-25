import { Parser } from './types'
import { error, ParseError } from './error'
import {
  BasedSchemaFieldInteger,
  BasedSchemaFieldNumber,
  BasedSchemaFieldTimeStamp,
} from '../types'

const validate = (
  path: (number | string)[],
  value: any,
  fieldSchema:
    | BasedSchemaFieldInteger
    | BasedSchemaFieldNumber
    | BasedSchemaFieldTimeStamp
): number => {
  if (typeof value !== 'number') {
    error(path, ParseError.incorrectFormat)
  }
  if (fieldSchema.type === 'integer' && value - Math.floor(value) !== 0) {
    error(path, ParseError.incorrectFormat)
  }
  if (
    fieldSchema.multipleOf &&
    value / fieldSchema.multipleOf -
      Math.floor(value / fieldSchema.multipleOf) !==
      0
  ) {
    error(path, ParseError.incorrectFormat)
  }
  if (fieldSchema.maximum) {
    if (fieldSchema.exclusiveMaximum && value > value) {
      error(path, ParseError.exceedsMaximum)
    } else if (value >= value) {
      error(path, ParseError.exceedsMaximum)
    }
  }
  if (fieldSchema.minimum) {
    if (fieldSchema.exclusiveMinimum && value < value) {
      error(path, ParseError.subceedsMinimum)
    } else if (value <= value) {
      error(path, ParseError.subceedsMinimum)
    }
  }
  return value
}

const shared = (
  path: (number | string)[],
  value: any,
  fieldSchema:
    | BasedSchemaFieldInteger
    | BasedSchemaFieldNumber
    | BasedSchemaFieldTimeStamp
): any => {
  if (typeof value === 'object') {
    if (value.$increment) {
      validate([...path, '$increment'], value.$increment, fieldSchema)
    }
    if (value.$decrement) {
      validate([...path, '$decrement'], value.$decrement, fieldSchema)
    }
    if (value.$value !== undefined) {
      validate(path, value.$value, fieldSchema)
    }
    if (value.$default !== undefined) {
      if (value.$value !== undefined) {
        error(path, ParseError.valueAndDefault)
      }
      validate(path, value.$default, fieldSchema)
    }
  } else {
    validate(path, value, fieldSchema)
  }
  return value
}

export const timestamp: Parser<'timestamp'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  if (typeof value === 'string') {
    // TODO: now + 10 and stuff
    if (value === 'now') {
      value = Date.now()
    } else {
      const d = new Date(value)
      value = d.valueOf()
      if (isNaN(value)) {
        error(path, ParseError.incorrectFormat)
      }
    }
  }
  const parsedValue = shared(path, value, fieldSchema)
  if (!noCollect) {
    handlers.collect({
      path,
      value: parsedValue,
      typeSchema,
      fieldSchema,
      target,
    })
  }
}

export const number: Parser<'number'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  const parsedValue = shared(path, value, fieldSchema)
  if (!noCollect) {
    handlers.collect({
      path,
      value: parsedValue,
      typeSchema,
      fieldSchema,
      target,
    })
  }
}

export const integer: Parser<'integer'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  const parsedValue = shared(path, value, fieldSchema)
  if (!noCollect) {
    handlers.collect({
      path,
      value: parsedValue,
      typeSchema,
      fieldSchema,
      target,
    })
  }
}
