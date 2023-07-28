import { ParseError } from '../../set/error'
import { FieldParser } from '../../walker'

export const object: FieldParser<'object'> = async (args) => {
  if (typeof args.value !== 'object') {
    args.error(args, ParseError.incorrectFormat)
    return
  }
  const isArray = Array.isArray(args.value)
  if (isArray) {
    args.error(args, ParseError.incorrectFormat)
    return
  }
  return args
}

export const record: FieldParser<'record'> = async (args) => {
  if (typeof args.value !== 'object') {
    args.error(args, ParseError.incorrectFormat)
    return
  }
  const isArray = Array.isArray(args.value)
  if (isArray) {
    args.error(args, ParseError.incorrectFormat)
    return
  }
  return args
}
