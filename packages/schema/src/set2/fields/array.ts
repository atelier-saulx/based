import { setByPath } from '@saulx/utils'
import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import { BasedSetTarget } from '../../types'

const parseArray = async (
  args: Args<BasedSetTarget, 'array'>,
  value: any
): Promise<any[]> => {
  const insert = Array.isArray(value) ? value : [value]
  const q: Promise<any>[] = []
  const arr = new Array(insert.length)
  for (let i = 0; i < insert.length; i++) {
    q.push(
      args.parse(
        { ...args, path: [] },
        i,
        insert[i],
        args.fieldSchema.values,
        false,
        (args, v) => {
          setByPath(arr, args.path, v)
        }
      )
    )
  }
  await Promise.all(q)
  return arr
}

const operations: {
  [key: string]: (
    args: Args<BasedSetTarget, 'array'>,
    value: any
  ) => Promise<void>
} = {
  $insert: async (args, value) => {
    if (
      typeof value.$insert !== 'object' ||
      typeof value.$remove.$idx !== 'number'
    ) {
      args.error(args, ParseError.incorrectFormat)
      return
    }
    value.$insert.$value = parseArray(args, value.$insert.$value)
    args.collect(args, value)
  },
  $push: async (args, value) => {
    value.$push = parseArray(args, value.$push)
    args.collect(args, value)
  },
  $unshift: async (args, value) => {
    value.$unshift = parseArray(args, value.$push)
    args.collect(args, value)
  },
  $remove: async (args, value) => {
    if (typeof value.$remove.$idx !== 'number') {
      args.error(args, ParseError.incorrectFormat)
      return
    }
    args.collect(args, value)
  },
  $assign: async (args, value) => {
    if (
      typeof value.$assign !== 'object' ||
      typeof value.$assign.$idx !== 'number'
    ) {
      args.error(args, ParseError.incorrectFormat)
      return
    }
    await args.parse(args, value.$assign.$idx, args.fieldSchema.values)
  },
}

export const array: FieldParser<'array'> = async (args) => {
  args.stop()
  const { error, collect, parse, fieldSchema } = args
  if (typeof args.value !== 'object') {
    error(args, ParseError.incorrectFormat)
    return
  }
  let value = '$value' in args.value ? args.value.$value : args.value
  if (Array.isArray(value)) {
    const q: Promise<any>[] = []
    collect(args, { $delete: true })
    for (let i = 0; i < value.length; i++) {
      q.push(parse(args, i, args.value[i], fieldSchema.values))
    }
    await Promise.all(q)
    return
  }
  let hasOperation = false
  for (const key in value) {
    if (operations[key]) {
      if (hasOperation) {
        error(args, ParseError.multipleOperationsNotAllowed)
        return
      }
      await operations[key](args, value)
      hasOperation = true
    } else {
      error(args, ParseError.fieldDoesNotExist)
    }
  }
}
