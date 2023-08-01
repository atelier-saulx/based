import { setByPath } from '@saulx/utils'
import { ParseError } from '../../set/error'
import { FieldParser, ArgsClass } from '../../walker'
import { BasedSetTarget } from '../../types'

const parseArray = async (
  args: ArgsClass<BasedSetTarget, 'array'>,
  value: any
): Promise<any[]> => {
  const fromValue = Array.isArray(value) ? value : [value]
  const q: Promise<any>[] = []
  const arr = new Array(fromValue.length)
  for (let i = 0; i < fromValue.length; i++) {
    q.push(
      args.parse({
        path: [i],
        value: fromValue[i],
        fieldSchema: args.fieldSchema.values,
        collect: (args, v) => {
          setByPath(arr, args.path, v)
        },
      })
    )
  }
  await Promise.all(q)
  return arr
}

const operations: {
  [key: string]: (
    args: ArgsClass<BasedSetTarget, 'array'>,
    value: any
  ) => Promise<void>
} = {
  $insert: async (args, value) => {
    if (
      typeof value.$insert !== 'object' ||
      typeof value.$insert.$idx !== 'number'
    ) {
      args.error(ParseError.incorrectFormat)
      return
    }
    value.$insert.$value = await parseArray(args, value.$insert.$value)
    args.collect(value)
  },
  $push: async (args, value) => {
    value.$push = await parseArray(args, value.$push)
    args.collect(value)
  },
  $unshift: async (args, value) => {
    value.$unshift = await parseArray(args, value.$push)
    args.collect(value)
  },
  $remove: async (args, value) => {
    if (typeof value.$remove.$idx !== 'number') {
      args.error(ParseError.incorrectFormat)
      return
    }
    args.collect(value)
  },
  $assign: async (args, value) => {
    if (
      typeof value.$assign !== 'object' ||
      typeof value.$assign.$idx !== 'number'
    ) {
      args.error(ParseError.incorrectFormat)
      return
    }
    await args.parse({
      key: value.$assign.$idx,
      value: args.fieldSchema.values,
    })
  },
}

export const array: FieldParser<'array'> = async (args) => {
  args.stop()
  if (typeof args.value !== 'object') {
    args.error(ParseError.incorrectFormat)
    return
  }
  let value = '$value' in args.value ? args.value.$value : args.value
  if (Array.isArray(value)) {
    const q: Promise<any>[] = []
    args.collect({ $delete: true })
    for (let i = 0; i < value.length; i++) {
      q.push(
        args.parse({
          key: i,
          value: args.value[i],
          fieldSchema: args.fieldSchema.values,
        })
      )
    }
    await Promise.all(q)
    return
  }
  let hasOperation = false
  for (const key in value) {
    if (operations[key]) {
      if (hasOperation) {
        args.error(ParseError.multipleOperationsNotAllowed)
        return
      }
      await operations[key](args, value)
      hasOperation = true
    } else {
      args.error(ParseError.fieldDoesNotExist)
    }
  }
}
