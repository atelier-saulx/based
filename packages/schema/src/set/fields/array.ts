import { setByPath } from '@saulx/utils'
import { ParseError } from '../../error'
import { FieldParser, ArgsClass } from '../../walker'
import { BasedSetTarget } from '../../types.js'

const collectOperation = (
  fromArgs: ArgsClass<BasedSetTarget, 'array'>,
  collected: any[],
  value: any,
  makeNegative?: number
) => {
  fromArgs.collect(value)
  if (collected.length) {
    const collect = fromArgs.root._opts.collect
    for (const args of collected) {
      if (makeNegative) {
        args.path[fromArgs.path.length] =
          args.path[fromArgs.path.length] - makeNegative

        collect(args)
      } else {
        collect(args)
      }
    }
  }
}

const parseArray = async (
  args: ArgsClass<BasedSetTarget, 'array'>,
  value: any,
  idx: number = 0
): Promise<{ collected: ArgsClass<BasedSetTarget>[]; arr: any[] }> => {
  const fromValue = Array.isArray(value) ? value : [value]
  const q: Promise<any>[] = []
  const arr = new Array(fromValue.length)
  const collectNested = ['object', 'record', 'text'].includes(
    args.fieldSchema.values.type
  )
  const collected: ArgsClass<BasedSetTarget>[] = []
  for (let i = 0; i < fromValue.length; i++) {
    q.push(
      args.parse({
        key: i + idx,
        value: fromValue[i],
        fieldSchema: args.fieldSchema.values,
        collect: (nArgs) => {
          const p = nArgs.path.slice(args.path.length)
          // @ts-ignore
          p[0] = p[0] - idx
          setByPath(arr, p, nArgs.value)
          if (collectNested) {
            collected.push(nArgs)
          }
        },
      })
    )
  }
  await Promise.all(q)
  return { arr, collected }
}

const operations: {
  [key: string]: (
    args: ArgsClass<BasedSetTarget, 'array'>,
    value: any
  ) => Promise<void>
} = {
  $insert: async (args, value) => {
    if (typeof value.$insert.$idx !== 'number') {
      args.error(ParseError.incorrectFormat)
      return
    }
    const { collected, arr } = await parseArray(
      args,
      value.$insert.$value,
      value.$insert.$idx
    )
    value.$insert.$value = arr
    collectOperation(args, collected, value)
  },
  $push: async (args, value) => {
    const { collected, arr } = await parseArray(
      args,
      value.$push.$value ?? value.$push
    )
    value.$push = arr
    collectOperation(args, collected, value, arr.length)
  },
  $unshift: async (args, value) => {
    const { collected, arr } = await parseArray(
      args,
      value.$unshift.$value ?? value.$unshift
    )
    value.$unshift = arr
    collectOperation(args, collected, value)
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
      value: value.$assign.$value,
      fieldSchema: args.fieldSchema.values,
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
