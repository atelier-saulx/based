import { setByPath } from '@saulx/utils'
import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import { BasedSetTarget } from '../../types'

const parseArray = async (
  args: Args<BasedSetTarget, 'array'>,
  val: any
): Promise<any[]> => {
  const insert = Array.isArray(val) ? val : [val]
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

  if ('$insert' in value) {
    if (
      typeof value.$insert !== 'object' ||
      typeof value.$remove.$idx !== 'number'
    ) {
      error(args, ParseError.incorrectFormat)
      return
    }
    value.$insert.$value = parseArray(args, value.$insert.$value)
    hasOperation = true
  }

  if ('$remove' in value) {
    if (hasOperation) {
      error(args, ParseError.multipleOperationsNotAllowed)
      return
    }
    if (typeof value.$remove.$idx !== 'number') {
      error(args, ParseError.incorrectFormat)
      return
    }
    hasOperation = true
  }

  if ('$push' in value) {
    if (hasOperation) {
      error(args, ParseError.multipleOperationsNotAllowed)
      return
    }
    value.$push = parseArray(args, value.$push)
    hasOperation = true
  }

  if ('$unshift' in value) {
    if (hasOperation) {
      error(args, ParseError.multipleOperationsNotAllowed)
      return
    }
    value.$unshift = parseArray(args, value.$unshift)
    hasOperation = true
  }

  if ('unshift' in value) {
    if (hasOperation) {
      error(args, ParseError.multipleOperationsNotAllowed)
      return
    }
    if (
      typeof value.$assign !== 'object' ||
      typeof value.$assign.$idx !== 'number'
    ) {
      error(args, ParseError.incorrectFormat)
      return
    }
    await parse(args, value.$assign.$idx, fieldSchema.values)
    return
  }

  collect(args, value)
}
