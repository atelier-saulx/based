import { FieldParsers } from '../../walker'
import { ParseError } from '../../set/error'
import { BasedSetTarget } from '../../types'
import { array } from './array'
import { object, record } from './object'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepEqual } from '@saulx/utils'

export const fields: Partial<FieldParsers<BasedSetTarget>> = {
  array,
  object,
  record,
  cardinality: async (args) => {
    const { value, error } = args
    let hashedValue: string
    if (value && typeof value === 'object') {
      args.stop()
      if (value.$default !== undefined) {
        error(args, ParseError.defaultNotSupported)
        return
      }
      if (value.$value !== undefined) {
        hashedValue = hashObjectIgnoreKeyOrder(value.$value).toString(16)
      } else {
        hashedValue = hashObjectIgnoreKeyOrder(value).toString(16)
      }
    } else {
      hashedValue = hash(value).toString(16)
    }
    args.collect(args, hashedValue)
  },
  boolean: async (args) => {
    if (typeof args.value !== 'boolean') {
      args.error(args, ParseError.incorrectFormat)
      return
    }
    args.collect(args)
  },
  enum: async (args) => {
    const { fieldSchema, error, collect, value } = args
    const enumValues = fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], value)) {
        collect(args, i)
        return
      }
    }
    error(args, ParseError.incorrectFormat)
  },
}
