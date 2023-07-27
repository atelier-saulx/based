import { ParseError } from './set/error'
import {
  BasedSchema,
  BasedSchemaFieldObject,
  BasedSetHandlers,
  BasedSetTarget,
} from './types'
import { BasedSchemaType, BasedSchemaFields } from './types'

type Path = (string | number)[]

type ErrorHandler<T> = (args: Args<T>, code: ParseError) => void

type Parse<T> = (
  args: Args<T>,
  key?: string | number,
  value?: any
) => Promise<Args<T> | void> // If true will not continue

type BackTrack<T> = (
  args: Args<T>,
  fromBackTrack: any[],
  collectedCommands: any[]
) => any

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
  key?: number | string
  value: any
  target: T
  stop: () => void
  fromBackTrack: any[]
  parse: Parse<T>
  collect: (args: Args<T>) => any
  backtrack: BackTrack<T>
  requiresAsyncValidation: (validationType: any) => Promise<any>
  error: ErrorHandler<T>
}

export type FieldParser<K extends keyof BasedSchemaFields, T = any> = (
  args: Args<T, K>
) => Promise<Args<T> | void>

export type KeyParser<T = any> = (
  args: Args<T, keyof BasedSchemaFields>
) => Promise<Args<T> | void>

export type Opts<T> = {
  schema: BasedSchema
  init: (args: Args<T>) => Promise<Args<T>>
  parsers: {
    fields: Partial<{
      [Key in keyof BasedSchemaFields]: FieldParser<Key, T>
    }>
    keys: { [key: string]: KeyParser<T> } // $list -> true
    any?: KeyParser<T> // y.x
    catch?: KeyParser<T> //
  }
  collect?: (args: Args<T>) => any
  backtrack?: BackTrack<T>
  requiresAsyncValidation?: (validationType: any) => Promise<boolean>
  errorsCollector?: ErrorHandler<T>
}

export const walk = async <T>(
  opts: Opts<T>,
  value: any
): Promise<{
  target: T
  errors: { code: ParseError; message: string }[]
}> => {
  const errors: { code: ParseError; message: string }[] = []

  if (!('collect' in opts)) {
    opts.collect = () => {}
  }

  if (!('backtrack' in opts)) {
    opts.backtrack = (args, btC, c) => btC
  }

  if (!('requiresAsyncValidation' in opts)) {
    opts.requiresAsyncValidation = async () => true
  }

  const errorsCollector: ErrorHandler<T> = (args, code) => {
    const err = {
      code,
      message: `Error: ${ParseError[code]} - from "${
        args.path.length === 0 ? 'top' : args.path.join('.')
      }"`,
    }
    if (opts.errorsCollector) {
      opts.errorsCollector(args, code)
    }
    errors.push(err)
  }

  const parse: Parse<T> = async (prevArgs, key, value) => {
    const collectedCommands: any[] = []
    const fromBackTrack: any[] = []
    let stop = false
    const args: Args<T> = {
      schema: opts.schema,
      stop: () => {
        stop = true
      },
      path: key ? [...prevArgs.path, key] : prevArgs.path,
      key: key ?? prevArgs.path[prevArgs.path.length - 1],
      parentValue: value ? prevArgs.value : undefined,
      value: value ?? prevArgs.value,
      target: prevArgs.target,
      parse: prevArgs.parse,
      collect: (args) => {
        collectedCommands.push(opts.collect(args))
      },
      fromBackTrack,
      backtrack: opts.backtrack,
      error: errorsCollector,
      requiresAsyncValidation: prevArgs.requiresAsyncValidation,
    }
    if (typeof args.value === 'object' && args.value !== null) {
      const keyQ: Promise<Args<T> | void>[] = []
      const keysHandled: Set<string | number> = new Set()

      for (const key in opts.parsers.keys) {
        if (key in args.value) {
          keysHandled.add(key)
          keyQ.push(
            (async () => {
              const newArgs = await opts.parsers.keys[key]({
                ...args,
                value: args.value[key],
                path: [...args.path, key],
                key,
              })
              if (newArgs) {
                return parse(newArgs)
              }
            })()
          )
        }
      }

      await Promise.all(keyQ)

      const fieldQ: Promise<Args<T> | void>[] = []

      if (!stop) {
        if (args.typeSchema && !args.fieldSchema) {
          // top level
          for (const key in args.typeSchema.fields) {
            const fieldSchema = args.typeSchema.fields[key]
            const fieldParser = opts.parsers.fields[fieldSchema.type]
            if (fieldParser) {
              keysHandled.add(key)
              if (args.value[key]) {
                fieldQ.push(
                  (async () => {
                    const newArgs = await fieldParser({
                      ...args,
                      value: args.value[key],
                      path: [...args.path, key],
                      // @ts-ignore
                      fieldSchema,
                      key,
                    })
                    if (newArgs) {
                      return parse(newArgs)
                    }
                  })()
                )
              }
            }
          }
        } else if (args.fieldSchema) {
          if (args.fieldSchema.type === 'object') {
            // @ts-ignore should detect from line above
            const objFieldSchema: BasedSchemaFieldObject = args.fieldSchema
            for (const key in objFieldSchema.properties) {
              const fieldSchema = objFieldSchema.properties[key]
              const fieldParser = opts.parsers.fields[fieldSchema.type]
              if (fieldParser) {
                keysHandled.add(key)
                if (args.value[key]) {
                  fieldQ.push(
                    (async () => {
                      const newArgs = await fieldParser({
                        ...args,
                        value: args.value[key],
                        path: [...args.path, key],
                        // @ts-ignore
                        fieldSchema,
                        key,
                      })
                      if (newArgs) {
                        return parse(newArgs)
                      }
                    })()
                  )
                }
              }
            }
            // from here to array and continue!
          }
        }

        if (!stop) {
          const q: Promise<Args<T> | void>[] = []
          if (Array.isArray(args.value)) {
            for (let i = 0; i < args.value.length; i++) {
              if (keysHandled.has(i)) {
                continue
              }
              const parser = opts.parsers.any
              const j = i
              q.push(
                (async () => {
                  const newArgs = await parser({
                    ...args,
                    value: args.value[j],
                    path: [...args.path, j],
                    key: j,
                  })
                  if (newArgs) {
                    return parse(newArgs)
                  }
                })()
              )
            }
          } else {
            const anyParser = opts.parsers.any || opts.parsers.catch
            for (const key in args.value) {
              if (!opts.parsers.any && keysHandled.has(key)) {
                continue
              }
              q.push(
                (async () => {
                  const newArgs = await anyParser({
                    ...args,
                    value: args.value[key],
                    path: [...args.path, key],
                    key,
                  })
                  if (newArgs) {
                    return parse(newArgs)
                  }
                })()
              )
            }
          }
          await Promise.all(q)
        }
      }

      if (
        !args.skipCollection &&
        (fromBackTrack.length || collectedCommands.length)
      ) {
        const x = args.backtrack(args, fromBackTrack, collectedCommands)
        if (x) {
          prevArgs.fromBackTrack?.push(x)
        }
      }
    }
  }
  const args: Args<T> = await opts.init(<Args<T>>{
    schema: opts.schema,
    path: [],
    value,
    parse,
    stop: () => {},
    collect: opts.collect,
    backtrack: opts.backtrack,
    error: errorsCollector,
    requiresAsyncValidation: opts.requiresAsyncValidation,
  })

  // if errors throw them!

  if (!args) {
    return {
      // TODO: temp
      // @ts-ignore // for now
      target: {},
      errors,
    }
  }

  await parse(args)
  return {
    target: args.target,
    errors,
  }
}
