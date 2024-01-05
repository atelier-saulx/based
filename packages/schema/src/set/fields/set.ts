import { ParseError } from '../../error.js'
import { ArgsClass, FieldParser } from '../../walker/index.js'

async function parseOperator<T>(
  args: ArgsClass<T, 'set'>,
  key: string
): Promise<any[]> {
  if (Array.isArray(args.value[key])) {
    const n = args.create({
      key,
      skipCollection: true,
      value: args.value[key],
    })
    await n.parse()
    if (n.value?.$value) {
      return n.value.$value
    }
    return []
  }
  const n = args.create({
    key,
    skipCollection: true,
    value: args.value[key],
    fieldSchema: args.fieldSchema.items,
  })
  await n.parse()
  return [n.value]
}

export const set: FieldParser<'set'> = async (args) => {
  if (typeof args.value !== 'object' || args.value === null) {
    args.error(ParseError.incorrectFormat)
    return
  }
  args.stop()
  const isArray = Array.isArray(args.value)
  if (isArray) {
    const newArgs: ArgsClass<typeof args.target>[] = []
    for (let i = 0; i < args.value.length; i++) {
      newArgs.push(
        args.create({
          key: i,
          value: args.value[i],
          fieldSchema: args.fieldSchema.items,
          skipCollection: true,
        })
      )
    }
    await Promise.all(newArgs.map((args) => args.parse()))
    args.value = { $value: newArgs.map((args) => args.value) }
  } else {
    for (const key in args.value) {
      if (key === '$add') {
        args.value.$add = await parseOperator(args, key)
      } else if (key === '$remove') {
        args.value.$remove = await parseOperator(args, key)
      } else {
        args.create({ key }).error(ParseError.fieldDoesNotExist)
      }
    }
  }
  args.collect()
}
