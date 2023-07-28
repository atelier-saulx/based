import { setByPath } from '@saulx/utils'
import { ParseError } from '../../set/error'
import { FieldParser } from '../../walker'

export const array: FieldParser<'array'> = async (args) => {
  args.stop()
  const { value, error, parse, fieldSchema } = args
  let isArray = Array.isArray(value)
  let parsedValue = value
  let opCount = 0
  let has$Value = false
  if (typeof parsedValue === 'object' && !isArray) {
    if (value.$value) {
      opCount++
      has$Value = true
      parsedValue = value.$value
      isArray = Array.isArray(parsedValue)
    }
    if (value.$insert) {
      opCount++
      if (opCount > 1) {
        error(args, ParseError.multipleOperationsNotAllowed)
        return
      }
      if (
        typeof value.$insert !== 'object' ||
        value.$insert.$idx === undefined
      ) {
        error(args, ParseError.incorrectFormat)
        return
      } else {
        const insert = Array.isArray(value.$insert.$value)
          ? value.$insert.$value
          : [value.$insert.$value]
        const q: Promise<any>[] = []
        parsedValue.$insert.$value = new Array(insert.length)
        for (let i = 0; i < insert.length; i++) {
          q.push(
            parse(
              { ...args, path: [] },
              i,
              insert[i],
              fieldSchema.values,
              false,
              (args, v) => {
                setByPath(parsedValue.$insert.$value, args.path, v)
              }
            )
          )
        }
        await Promise.all(q)
      }
    }
    if (value.$remove) {
      opCount++
      if (opCount > 1) {
        error(args, ParseError.multipleOperationsNotAllowed)
        return
      }
      if (value.$remove.$idx === undefined) {
        error(args, ParseError.incorrectFormat)
        return
      }
    }
    if (value.$push) {
      opCount++
      if (opCount > 1) {
        error(args, ParseError.multipleOperationsNotAllowed)
        return
      }
      const q: Promise<any>[] = []
      const push = Array.isArray(value.$push) ? value.$push : [value.$push]
      for (let i = 0; i < push.length; i++) {
        q.push(parse(args, i, push[i], fieldSchema.values, true))
      }
      await Promise.all(q)
      parsedValue = { $push: push }
    }
    if (value.$unshift) {
      opCount++
      if (opCount > 1) {
        error(args, ParseError.multipleOperationsNotAllowed)
        return
      }
      const q: Promise<any>[] = []
      const unshift = Array.isArray(value.$unshift)
        ? value.$unshift
        : [value.$unshift]
      for (let i = 0; i < unshift.length; i++) {
        q.push(parse(args, i, unshift[i], fieldSchema.values, true))
      }
      await Promise.all(q)
      parsedValue = { $unshift: unshift }
    }
    if (value.$assign) {
      opCount++
      if (opCount > 1) {
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
    if (!has$Value) {
      args.collect(args, parsedValue)
    }
    if (!has$Value) {
      return
    }
  }
  if (!isArray) {
    error(args, ParseError.incorrectFieldType)
    return
  }
  const q: Promise<any>[] = []
  args.collect(args, { $delete: true })
  for (let i = 0; i < parsedValue.length; i++) {
    q.push(parse(args, i, parsedValue[i], fieldSchema.values))
  }
  await Promise.all(q)
}
