import { Parser } from './types'
import { error, ParseError } from './error'
import {
  BasedSchemaFieldInteger,
  BasedSchemaFieldNumber,
  BasedSchemaFieldTimeStamp,
  BasedSetHandlers,
} from '../types'

const validate = (
  handlers: BasedSetHandlers,
  path: (number | string)[],
  value: any,
  fieldSchema:
    | BasedSchemaFieldInteger
    | BasedSchemaFieldNumber
    | BasedSchemaFieldTimeStamp
): number | false => {
  if (typeof value !== 'number') {
    error(handlers, ParseError.incorrectFormat, path)
    return false
  }
  if (fieldSchema.type === 'integer' && value - Math.floor(value) !== 0) {
    error(handlers, ParseError.incorrectFormat, path)
    return false
  }
  if (
    fieldSchema.multipleOf &&
    value / fieldSchema.multipleOf -
      Math.floor(value / fieldSchema.multipleOf) !==
      0
  ) {
    error(handlers, ParseError.incorrectFormat, path)
    return false
  }
  if (fieldSchema.maximum) {
    if (fieldSchema.exclusiveMaximum) {
      if (value >= fieldSchema.maximum) {
        error(handlers, ParseError.exceedsMaximum, path)
        return false
      }
    } else if (value > fieldSchema.maximum) {
      error(handlers, ParseError.exceedsMaximum, path)
      return false
    }
  }
  if (fieldSchema.minimum) {
    if (fieldSchema.exclusiveMinimum) {
      if (value <= fieldSchema.minimum) {
        error(handlers, ParseError.subceedsMinimum, path)
        return false
      }
    } else if (value < fieldSchema.minimum) {
      error(handlers, ParseError.subceedsMinimum, path)
      return false
    }
  }
  return value
}

const shared = (
  handlers: BasedSetHandlers,
  path: (number | string)[],
  value: any,
  fieldSchema:
    | BasedSchemaFieldInteger
    | BasedSchemaFieldNumber
    | BasedSchemaFieldTimeStamp
): any => {
  if (typeof value === 'object') {
    if (value.$increment) {
      validate(handlers, [...path, '$increment'], value.$increment, fieldSchema)
    }
    if (value.$decrement) {
      validate(handlers, [...path, '$decrement'], value.$decrement, fieldSchema)
    }
    if (value.$value !== undefined) {
      validate(handlers, path, value.$value, fieldSchema)
    }
    if (value.$default !== undefined) {
      if (value.$value !== undefined) {
        error(handlers, ParseError.valueAndDefault, path)
        return
      }
      validate(handlers, path, value.$default, fieldSchema)
    }
  } else {
    validate(handlers, path, value, fieldSchema)
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
        error(handlers, ParseError.incorrectFormat, path)
        return
      }
    }
  }
  const parsedValue = shared(handlers, path, value, fieldSchema)
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
  const parsedValue = shared(handlers, path, value, fieldSchema)
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
  const parsedValue = shared(handlers, path, value, fieldSchema)
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
