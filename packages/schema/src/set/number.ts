import { Parser } from './types'
import { error, ParseError } from './error'

export const timestamp: Parser<'timestamp'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  if (typeof value === 'string') {
    if (value === 'now') {
      value = Date.now()
    } else {
      const d = new Date(value)
      value = d.valueOf()
      if (isNaN(value)) {
        throw error(path, ParseError.incorrectFormat)
      }
    }
  }
  // // smaller then / larger then steps
  // if (typeof value !== 'number') {
  //   throw createError(path, target.type, 'timestamp', value)
  // }

  // if (fieldSchema.maximum) {
  //   if (fieldSchema.exclusiveMaximum && value > value) {
  //     throw createError(path, target.type, 'timestamp', value)
  //   } else if (value >= value) {
  //     throw createError(path, target.type, 'timestamp', value)
  //   }
  // }

  // if (fieldSchema.minimum) {
  //   if (fieldSchema.exclusiveMinimum && value < value) {
  //     throw createError(path, target.type, 'timestamp', value)
  //   } else if (value <= value) {
  //     throw createError(path, target.type, 'timestamp', value)
  //   }
  // }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}

export const number: Parser<'number'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  // value .default
  // $increment / $decrement

  if (typeof value !== 'number') {
    error(path, ParseError.incorrectFormat)
  }

  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}

export const integer: Parser<'integer'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  // value .default
  // $increment / $decrement
  if (typeof value !== 'number' || value - Math.floor(value) !== 0) {
    error(path, ParseError.incorrectFormat)
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}
