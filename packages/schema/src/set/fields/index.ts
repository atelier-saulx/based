import { FieldParsers } from '../../walker'
import { ParseError } from '../../error'
import { BasedSetTarget } from '../../types.js'
import { array } from './array'
import { object, record } from './object'
import { number, integer, timestamp } from './number'
import { string, text } from './string'
import { reference, references } from './references'
import { set } from './set'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepEqual } from '@saulx/utils'

export const fields: Partial<FieldParsers<BasedSetTarget>> = {
  array,
  object,
  record,
  number,
  integer,
  timestamp,
  string,
  set,
  text,
  reference,
  references,
  cardinality: async (args) => {
    let hashedValue: string
    if (args.value && typeof args.value === 'object') {
      args.stop()
      if (args.value.$default !== undefined) {
        args.error(ParseError.defaultNotSupported)
        return
      }
      if (args.value.$value !== undefined) {
        hashedValue = hashObjectIgnoreKeyOrder(args.value.$value).toString(16)
      } else {
        hashedValue = hashObjectIgnoreKeyOrder(args.value).toString(16)
      }
    } else {
      hashedValue = hash(args.value).toString(16)
    }
    args.collect(hashedValue)
  },
  boolean: async (args) => {
    if (typeof args.value !== 'boolean') {
      args.error(ParseError.incorrectFormat)
      return
    }
    args.collect()
  },
  json: async (args) => {
    args.stop()
    try {
      const parsedValue = JSON.stringify(args.value)
      args.collect(parsedValue)
    } catch (err) {
      args.error(ParseError.invalidJSON)
    }
  },
  enum: async (args) => {
    // args.stop()
    const enumValues = args.fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], args.value)) {
        args.collect(i)
        return
      }
    }
    args.error(ParseError.incorrectFormat)
  },
}
