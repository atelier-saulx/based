import { ParseError } from '../../error'
import { FieldParser } from '../../walker'

export const object: FieldParser<'object'> = async (args) => {
  if (typeof args.value !== 'object' || args.value === null) {
    args.error(ParseError.incorrectFormat)
    return
  }
  const isArray = Array.isArray(args.value)
  if (isArray) {
    args.error(ParseError.incorrectFormat)
    return
  }
  args.collect()
  return args
}

export const record: FieldParser<'record'> = async (args) => {
  if (typeof args.value !== 'object' || args.value === null) {
    args.error(ParseError.incorrectFormat)
    return
  }
  const isArray = Array.isArray(args.value)
  if (isArray) {
    args.error(ParseError.incorrectFormat)
    return
  }
  args.collect()
  return args
}
