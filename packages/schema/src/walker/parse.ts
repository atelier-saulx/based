import {
  BasedSchemaField,
  BasedSchemaFieldObject,
  BasedSchemaFieldRecord,
  BasedSchemaFields,
} from '../types'
import { ArgsClass } from './args'
import { ArgsOpts, FieldParser, KeyParser, Stopped } from './types'

type ParseResult<T> = ArgsClass<T> | void

// TODO needs cleaning
function createOrUseArgs<T>(
  from: ArgsClass<T>,
  newArgs: ArgsClass<T> | ArgsOpts<T> | void
): ParseResult<T> {
  if (!newArgs) {
    return
  }
  if (newArgs instanceof ArgsClass) {
    return newArgs
  }
  return from.create(newArgs)
}

async function parseKey<T>(
  from: ArgsClass<T>,
  key: string | number,
  parser: KeyParser<T>
): Promise<ParseResult<T>> {
  const keyArgs = new ArgsClass(
    {
      key,
      value: from.value[key],
      fieldSchema: from.fieldSchema,
    },
    from
  )
  const newArgs = createOrUseArgs(keyArgs, await parser(keyArgs))
  if (newArgs) {
    return newArgs.parse()
  }
}

function createFieldArgs<T>(
  from: ArgsClass<T>,
  key: string | number,
  fieldSchema: BasedSchemaField
): ArgsClass<T> {
  return new ArgsClass(
    {
      key,
      value: from.value[key],
      // @ts-ignore needs key
      fieldSchema,
    },
    from
  )
}

function getFieldParser<T>(
  args: ArgsClass<T>
): void | FieldParser<keyof BasedSchemaFields> {
  const fieldParser =
    'enum' in args.fieldSchema
      ? args.root._opts.parsers.fields.enum
      : args.root._opts.parsers.fields[args.fieldSchema.type]
  return fieldParser
}

export async function parse<T>(
  args: ArgsClass<T>
): Promise<ArgsClass<T> | void> {
  const opts = args.root._opts
  if (typeof args.value === 'object' && args.value !== null) {
    const keyQ: Promise<ParseResult<T>>[] = []
    const keysHandled: Set<string | number> = new Set()
    let allKeysHandled = false

    for (const key in opts.parsers.keys) {
      if (key in args.value) {
        keysHandled.add(key)
        keyQ.push(parseKey(args, key, opts.parsers.keys[key]))
      }
    }
    await Promise.all(keyQ)

    if (args.stopped === undefined) {
      const fieldQ: Promise<ParseResult<T>>[] = []
      if (args.typeSchema && !args.fieldSchema) {
        for (const key in args.typeSchema.fields) {
          const fieldSchema = args.typeSchema.fields[key]
          if (key in args.value) {
            keysHandled.add(key)
            fieldQ.push(createFieldArgs(args, key, fieldSchema).parse())
          }
        }
      } else if (args.fieldSchema && !args.stopped) {
        if (args.fieldSchema.type === 'object') {
          // @ts-ignore should detect from line above
          const objFieldSchema: BasedSchemaFieldObject = args.fieldSchema
          for (const key in objFieldSchema.properties) {
            const fieldSchema = objFieldSchema.properties[key]
            if (key in args.value) {
              keysHandled.add(key)
              fieldQ.push(createFieldArgs(args, key, fieldSchema).parse())
            }
          }
        } else if (args.fieldSchema.type === 'record') {
          // @ts-ignore should detect from line above
          const objFieldSchema: BasedSchemaFieldRecord = args.fieldSchema
          for (const key in args.value) {
            const fieldSchema = objFieldSchema.values
            keysHandled.add(key)
            fieldQ.push(createFieldArgs(args, key, fieldSchema).parse())
          }
        } else if (args.fieldSchema) {
          const fieldParser = getFieldParser(args)
          if (fieldParser) {
            const newArgs = createOrUseArgs(args, await fieldParser(args))
            if (newArgs) {
              return newArgs.parse()
            }
          }
        }
      }
      await Promise.all(fieldQ)
    }

    if (args.stopped !== Stopped.stopAll) {
      const parser = opts.parsers.any || opts.parsers.catch
      if (parser) {
        const q: Promise<ParseResult<T>>[] = []
        if (Array.isArray(args.value)) {
          for (let i = 0; i < args.value.length; i++) {
            if ((!opts.parsers.any && keysHandled.has(i)) || allKeysHandled) {
              continue
            }
            q.push(parseKey(args, i, parser))
          }
        } else {
          for (const key in args.value) {
            if ((!opts.parsers.any && keysHandled.has(key)) || allKeysHandled) {
              continue
            }
            q.push(parseKey(args, key, parser))
          }
        }
        await Promise.all(q)
      }
    }

    if (
      opts.backtrack &&
      !args.skipCollection &&
      (args.fromBackTrack.length || args.collectedCommands.length)
    ) {
      const backtracked = opts.backtrack(
        this,
        args.fromBackTrack ?? [],
        args.collectedCommands ?? []
      )
      if (backtracked && this.prev) {
        if (!this.prev.fromBackTrack) {
          this.prev.fromBackTrack = []
        }
        this.prev.fromBackTrack.push(backtracked)
      }
    }
  } else {
    if (args.fieldSchema) {
      const fieldParser = getFieldParser(args)
      if (fieldParser) {
        const newArgs = createOrUseArgs(args, await fieldParser(args))
        if (newArgs) {
          return newArgs.parse()
        }
      } else {
        console.warn('fieldSchema type not implemented yet!', args.fieldSchema)
        const anyParser = opts.parsers.any || opts.parsers.catch
        anyParser(args)
      }
    }
  }
}
