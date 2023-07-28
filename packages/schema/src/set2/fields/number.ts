import { ParseError } from '../../set/error'
import { FieldParser } from '../../walker'

const fieldSchemaUtil = (args) => {
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

export const number: FieldParser<'number'> = async (args) => {
  // $increment
  // $decrement

  if (typeof args.value === 'object') {
    args.stop()
    // $default..

    // for (let key in args.value) {
    // key !== $value | $default |  $incrmeent
    // error(wrong field)
    // }
  }

  if (typeof args.value !== 'number') {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  if (!fieldSchemaUtil(args)) {
    return
  }
  return args
}
export const integer: FieldParser<'integer'> = async (args) => {
  if (typeof args.value !== 'number') {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  if (args.value - Math.floor(args.value) !== 0) {
    args.error(args, ParseError.incorrectFieldType)
    return
  }
  if (!fieldSchemaUtil(args)) {
    return
  }
  return args
}
