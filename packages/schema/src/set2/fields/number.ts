import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import { BasedSetTarget } from '../../types'

type NumberTypes = 'number' | 'timestamp' | 'integer'

const validateNumber = (
  args: Args<BasedSetTarget, NumberTypes>,
  value: number,
  ignoreMinMax?: boolean
): boolean => {
  const { fieldSchema } = args
  if (typeof value !== 'number') {
    args.error(args, ParseError.incorrectFormat)
    return false
  }

  if (fieldSchema.type === 'integer' && value - Math.floor(value) !== 0) {
    args.error(args, ParseError.incorrectFormat)
    return false
  }

  if (
    fieldSchema.multipleOf &&
    value / fieldSchema.multipleOf -
      Math.floor(value / fieldSchema.multipleOf) !==
      0
  ) {
    args.error(args, ParseError.incorrectFormat)
    return false
  }

  if (ignoreMinMax) {
    // TODO: maybe add async validator getting the actual value from the db OR checking the result of the $incr/$decr operation
    return true
  }

  if (fieldSchema.maximum) {
    if (fieldSchema.exclusiveMaximum) {
      if (value >= fieldSchema.maximum) {
        args.error(args, ParseError.exceedsMaximum)
        return false
      }
    } else if (value > fieldSchema.maximum) {
      args.error(args, ParseError.exceedsMaximum)
      return false
    }
  }

  if (fieldSchema.minimum) {
    if (fieldSchema.exclusiveMinimum) {
      if (value <= fieldSchema.minimum) {
        args.error(args, ParseError.subceedsMinimum)
        return false
      }
    } else if (value < fieldSchema.minimum) {
      args.error(args, ParseError.subceedsMinimum)
      return false
    }
  }

  return true
}

const validate = (
  args: Args<BasedSetTarget, NumberTypes>,
  value: any
): boolean => {
  if (typeof value !== 'object') {
    return validateNumber(args, value)
  }

  if ('$increment' in value) {
    args.stop()
    return validateNumber(args, value.$increment, true)
  }

  if ('$decrement' in value) {
    args.stop()
    return validateNumber(args, value.$decrement, true)
  }
}

export const number: FieldParser<'number'> = async (args) => {
  if (!validate(args, args.value)) {
    return
  }

  args.collect(args)
}

export const integer: FieldParser<'integer'> = async (args) => {
  if (!validate(args, args.value)) {
    return
  }

  args.collect(args)
}

/*
  TODO: make nice
  'now + 1s'
  $incr 'week'
  $desc 'day' // hour / second 3s //
*/

export const timestamp: FieldParser<'timestamp'> = async (args) => {
  if (typeof args.value === 'string') {
    if (args.value === 'now') {
      // TODO: + 1s + 10s etc
      args.value = Date.now()
    } else {
      const d = new Date(args.value)
      args.value = d.valueOf()
      if (isNaN(args.value)) {
        args.error(args, ParseError.incorrectFormat)
        return
      }
    }
  }

  if (!validate(args, args.value)) {
    return
  }

  args.collect(args)
}
