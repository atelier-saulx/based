import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import { BasedSetTarget } from '../../types'

type NumberTypes = 'number' | 'timestamp' | 'integer'

const validator = (args: Args<BasedSetTarget, NumberTypes>): boolean => {
  const { fieldSchema, value } = args
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
  return true
}

const shared = async (
  args: Args<BasedSetTarget, NumberTypes>
): Promise<boolean> => {
  if (typeof args.value === 'object') {
    if ('$value' in args.value) {
      args.value = args.value.$value
      if (typeof args.value !== 'object') {
        return true
      }
    }
    for (let key in args.value) {
      if (key === '$increment') {
        await args.parse(args, '$increment', args.value[key])
      } else if (key === '$decrement') {
        await args.parse(args, '$decrement', args.value[key])
      } else if (key === 'default') {
        await args.parse(args, '$default', args.value[key])
      } else {
        args.error(args, ParseError.fieldDoesNotExist)
        return false
      }
    }
  } else if (typeof args.value !== 'number') {
    args.error(args, ParseError.incorrectFormat)
    return false
  }
  return true
}

export const number: FieldParser<'number'> = async (args) => {
  args.stop()
  if (!shared(args) || !validator(args)) {
    return
  }
  if (typeof args.value !== 'number') {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  return args
}

export const integer: FieldParser<'integer'> = async (args) => {
  args.stop()
  if (!shared(args) || !validator(args)) {
    return
  }
  if (typeof args.value !== 'number') {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  if (args.value - Math.floor(args.value) !== 0) {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  return args
}
export const timestamp: FieldParser<'timestamp'> = async (args) => {
  if (!shared(args)) {
    return
  }
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
  }

  if (typeof args.value !== 'number') {
    return
  }
  if (!validator(args)) {
    return
  }

  return args
}
