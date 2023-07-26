import { ParseError } from './set/error'
import { BasedSchema, BasedSetHandlers, BasedSetTarget } from './types'
import { BasedSchemaType, BasedSchemaFields } from './types'

type Path = (string | number)[]

type ErrorHandler<T> = (args: Args<T>, code: ParseError) => void

type Parse<T> = (
  args: Args<T>,
  key?: string | number,
  value?: any
) => Promise<Args<T> | void> // If true will not continue

export type Args<
  T,
  K extends keyof BasedSchemaFields = keyof BasedSchemaFields
> = {
  schema: BasedSchema
  parentValue?: any
  skipCollection?: boolean
  fieldSchema?: BasedSchemaFields[K]
  typeSchema?: BasedSchemaType
  path: Path
  value: any
  target: T
  parse: Parse<T>
  collect: (args: Args<T>) => any
  backtrack: (collectedCommands: any[]) => any
  requiresAsyncValidaton: (validationType: any) => Promise<any>
  error: ErrorHandler<T>
}

export type FieldParser<T, K extends keyof BasedSchemaFields> = (
  args: Args<T, K>
) => Promise<Args<T> | void>

export type KeyParser<T> = (
  args: Args<T, keyof BasedSchemaFields>
) => Promise<Args<T> | void>

export type Opts<T> = {
  schema: BasedSchema
  init: (
    value: any,
    opts: Opts<T>,
    errors: { code: ParseError; message: string }[]
  ) => Promise<T>
  parsers: {
    fields: Partial<{
      [Key in keyof BasedSchemaFields]: FieldParser<T, Key>
    }>
    keys: { [key: string]: KeyParser<T> } // $list -> true
    any: KeyParser<T> // y.x
  }
  collect: (args: Args<T>) => any
  backtrack: (collectedCommands: any[]) => any // from back TRACKS OR COLLECT
  requiresAsyncValidaton: (validationType: any) => Promise<boolean>
}

export const walk = async <T>(
  opts: Opts<T>,
  value: any
): Promise<{
  target: T
  errors: { code: ParseError; message: string }[]
}> => {
  const errors: { code: ParseError; message: string }[] = []
  const target = await opts.init(value, opts, errors)

  const errorsCollector: ErrorHandler<T> = (args, code) => {
    errors.push({
      code,
      message: 'flap flap',
    })
  }

  const parse: Parse<T> = async (prevArgs, key, value) => {
    const collectedCommands: any[] = []
    const fromBackTrack: any[] = []
    const args: Args<T> = {
      schema: opts.schema,
      path: key ? [...prevArgs.path, key] : prevArgs.path,
      parentValue: value ? prevArgs.value : undefined,
      value: value ?? prevArgs.value,
      target,
      parse: prevArgs.parse,
      collect: (args) => {
        collectedCommands.push(opts.collect(args))
      },
      backtrack: (args) => {
        fromBackTrack.push(opts.backtrack(args))
      },
      error: errorsCollector,
      requiresAsyncValidaton: opts.requiresAsyncValidaton,
    }
    if (typeof args.value === 'object' && args.value !== null) {
      const q: Promise<Args<T> | void>[] = []
      if (Array.isArray(args.value)) {
        for (let i = 0; i < args.value.length; i++) {
          //
          const parser = opts.parsers.keys[i] || opts.parsers.any
          q.push(
            parser({ ...args, value: args.value[i], path: [...args.path, i] })
          )
        }
      } else {
        for (const key in args.value) {
          const parser = opts.parsers.keys[key] || opts.parsers.any
          q.push(
            (async () => {
              const newArgs = await parser({
                ...args,
                value: args.value[key],
                path: [...args.path, key],
              })

              if (newArgs) {
                return parse(newArgs)
              }
            })()
          )
        }
      }
      await Promise.all(q)
      if (fromBackTrack.length) {
        opts.backtrack(fromBackTrack)
      } else if (collectedCommands.length) {
        opts.backtrack(collectedCommands)
      }
    }
  }

  const args: Args<T> = {
    schema: opts.schema,
    path: [],
    value,
    target,
    parse,
    collect: opts.collect,
    backtrack: opts.backtrack,
    error: errorsCollector,
    requiresAsyncValidaton: opts.requiresAsyncValidaton,
  }

  parse(args)

  return {
    target,
    errors,
  }
}
