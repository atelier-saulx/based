import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import { BasedSetTarget } from '../../types'

type NumberTypes = 'number' | 'timestamp' | 'integer'

const validate = (
  args: Args<BasedSetTarget, NumberTypes>,
  value
): number | false => {
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
  return value
}

const shared = (args: Args<BasedSetTarget, NumberTypes>, value: any): any => {
  console.log(1)
  if (typeof value === 'object') {
    console.log(2)
    if (value.$increment) {
      console.log(3)
      validate(args, value.$increment)
      return value.$increment
    }
    if (value.$decrement) {
      validate(args, value.$decrement)
    }
    if (value.$value !== undefined) {
      validate(args, value.$value)
    }
    if (value.$default !== undefined) {
      if (value.$value !== undefined) {
        args.error(args, ParseError.valueAndDefault)
        return
      }
      validate(args, value.$default)
    }
  } else {
    validate(args, value)
  }
  return value
}

export const number: FieldParser<'number'> = async (args) => {
  await shared(args, args.value)
  args.collect(args)
}
export const integer: FieldParser<'integer'> = async (args) => {
  await shared(args, args.value)

  args.collect(args)
}

export const timestamp: FieldParser<'timestamp'> = async (args) => {
  if (typeof args.value === 'string') {
    if (args.value === 'now') {
      args.value = Date.now()
    } else {
      const d = new Date(args.value)
      args.value = d.valueOf()
      if (isNaN(args.value)) {
        args.error(args, ParseError.incorrectFormat)
        return
      }
    }
    console.log(args)
    await shared(args, args.value)

    args.collect(args)
  }
}
