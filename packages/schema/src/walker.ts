import { ParseError } from './set/error'
import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSetHandlers,
  BasedSetTarget,
} from './types'
import { BasedSchemaType, BasedSchemaFields } from './types'

type Path = (string | number)[]

type ErrorHandler<T> = (args: Args<T>, code: ParseError) => void

type Collect<T> = (args: Args<T>, value: any) => any

type Parse<T> = (
  args: Args<T>,
  key?: string | number,
  value?: any,
  fieldSchema?: BasedSchemaField,
  skipCollection?: boolean,
  collect?: (args: Args<T>, value?: any) => any
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
  actualCollect: Collect<T>
  collect: (args: Args<T>, value?: any) => any
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
      message: `Error: ${ParseError[code]} - "${
        args.path.length === 0 ? 'top' : args.path.join('.')
      }"`,
    }
    if (opts.errorsCollector) {
      opts.errorsCollector(args, code)
    }
    errors.push(err)
  }

  const parse: Parse<T> = async (
    prevArgs,
    key,
    value,
    fieldSchema,
    skipCollection,
    collect
  ) => {
    const collectedCommands: any[] = []
    const fromBackTrack: any[] = []
    let stop = false
    const args: Args<T> = {
      schema: opts.schema,
      stop: () => {
        stop = true
      },
      // @ts-ignore
      fieldSchema: fieldSchema ?? prevArgs.fieldSchema,
      typeSchema: prevArgs.typeSchema,
      path: key ? [...prevArgs.path, key] : prevArgs.path,
      key: key ?? prevArgs.path[prevArgs.path.length - 1],
      parentValue: value ? prevArgs.value : undefined,
      value: value ?? prevArgs.value,
      target: prevArgs.target,
      parse: prevArgs.parse,
      actualCollect: collect ?? prevArgs.actualCollect,
      collect: (args, value) => {
        if (!args.skipCollection) {
          collectedCommands.push(args.actualCollect(args, value ?? args.value))
        }
      },
      fromBackTrack,
      backtrack: prevArgs.backtrack,
      error: errorsCollector,
      requiresAsyncValidation: prevArgs.requiresAsyncValidation,
      skipCollection: skipCollection ?? prevArgs.skipCollection,
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
          for (const key in args.typeSchema.fields) {
            const fieldSchema = args.typeSchema.fields[key]
            const fieldParser = opts.parsers.fields[fieldSchema.type]

            if (fieldParser) {
              keysHandled.add(key)
              if (key in args.value) {
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
          // and more as well ofc..

          if (args.fieldSchema.type === 'object') {
            // @ts-ignore should detect from line above
            const objFieldSchema: BasedSchemaFieldObject = args.fieldSchema
            for (const key in objFieldSchema.properties) {
              const fieldSchema = objFieldSchema.properties[key]
              const fieldParser = opts.parsers.fields[fieldSchema.type]
              if (fieldParser) {
                keysHandled.add(key)
                if (key in args.value) {
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
          }
          // need more
        }

        await Promise.all(fieldQ)

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

  // @ts-ignore
  const args: Args<T> = await opts.init(<Args<T>>{
    schema: opts.schema,
    path: [],
    value,
    actualCollect: opts.collect,
    parse,
    stop: () => {},
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
