import { ParseError } from '../../error.js'
import { FieldParser, ArgsClass } from '../../walker/index.js'
import { BasedSetTarget } from '../../types.js'

type NumberTypes = 'number' | 'timestamp' | 'integer'

const validateNumber = (
  args: ArgsClass<BasedSetTarget, NumberTypes>,
  value: number,
  ignoreMinMax?: boolean
): boolean => {
  const { fieldSchema } = args
  if (typeof value !== 'number') {
    args.error(ParseError.incorrectFormat)
    return false
  }

  if (isNaN(value)) {
    args.error(ParseError.incorrectFormat)
    return false
  }

  if (value === Infinity || value === -Infinity) {
    args.error(ParseError.infinityNotSupported)
    return false
  }

  if (fieldSchema.type === 'integer' && value - Math.floor(value) !== 0) {
    args.error(ParseError.incorrectFormat)
    return false
  }

  if (
    fieldSchema.multipleOf &&
    value / fieldSchema.multipleOf -
      Math.floor(value / fieldSchema.multipleOf) !==
      0
  ) {
    args.error(ParseError.incorrectFormat)
    return false
  }

  if (ignoreMinMax) {
    // TODO: will be handled in the actual modify command
    return true
  }

  if (fieldSchema.maximum) {
    if (fieldSchema.exclusiveMaximum) {
      if (value >= fieldSchema.maximum) {
        args.error(ParseError.exceedsMaximum)
        return false
      }
    } else if (value > fieldSchema.maximum) {
      args.error(ParseError.exceedsMaximum)
      return false
    }
  }

  if (fieldSchema.minimum) {
    if (fieldSchema.exclusiveMinimum) {
      if (value <= fieldSchema.minimum) {
        args.error(ParseError.subceedsMinimum)
        return false
      }
    } else if (value < fieldSchema.minimum) {
      args.error(ParseError.subceedsMinimum)
      return false
    }
  }

  return true
}

const validate = (
  args: ArgsClass<BasedSetTarget, NumberTypes>,
  value: any
): boolean => {
  if (value === null) {
    return false
  }

  if (typeof value !== 'object') {
    return validateNumber(args, value)
  }
  if ('$value' in value) {
    return
  }

  args.stop()
  for (const key in value) {
    if (key === '$default') {
      if (!validateNumber(args, value.$default)) {
        return false
      }
    } else if (key === '$increment') {
      if (!validateNumber(args, value.$increment, true)) {
        return false
      }
    } else if (key === '$decrement') {
      if (!validateNumber(args, value.$decrement, true)) {
        return false
      }
    } else {
      args.create({ key }).error(ParseError.fieldDoesNotExist)
      return false
    }
  }
  return true
}

export const number: FieldParser<'number'> = async (args) => {
  if (!validate(args, args.value)) {
    return
  }
  args.collect()
}

export const integer: FieldParser<'integer'> = async (args) => {
  if (!validate(args, args.value)) {
    return
  }
  args.collect()
}

export const timestamp: FieldParser<'timestamp'> = async (args) => {
  if (typeof args.value === 'string') {
    if (args.value === 'now') {
      // TODO: + 1s + 10s etc
      args.value = Date.now()
    } else {
      const d = new Date(args.value)
      args.value = d.valueOf()
      if (isNaN(args.value)) {
        args.error(ParseError.incorrectFormat)
        return
      }
    }
  }
  if (!validateNumber(args, args.value)) {
    return
  }
  args.collect()
}
