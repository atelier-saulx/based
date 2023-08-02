import { ParseError } from '../set/error'
import { BasedSchema, BasedSetTarget } from '../types'
import { walk, Opts } from '../walker'
import { fields } from './fields'

const opts: Opts<BasedSetTarget> = {
  parsers: {
    keys: {
      $id: async (args) => {
        if (typeof args.value !== 'string') {
          args.error(ParseError.incorrectFormat)
          return
        }
        if (args.value.length > 10) {
          args.error(ParseError.incorrectFormat)
        }
      },
      $value: async (args) => {
        args.stop()
        if (args.prev.value.$default) {
          args.error(ParseError.valueAndDefault)
          return
        }
        return { path: args.path.slice(0, -1) }
      },
      $default: async (args) => {
        const type = args.fieldSchema?.type
        if (type === 'number' || type === 'integer') {
          // default can exist with $incr and $decr
          return
        }
        args.prev.stop()
        const newArgs = args.create({
          path: args.path.slice(0, -1),
          skipCollection: true,
        })
        await newArgs.parse()
        for (const key in args.prev.value) {
          if (key !== '$default') {
            args.prev.create({ key }).error(ParseError.fieldDoesNotExist)
          }
        }
        newArgs.skipCollection = false
        newArgs.value = { $default: newArgs.value }
        newArgs.collect()
      },
    },
    fields,
    catch: async (args) => {
      args.error(ParseError.fieldDoesNotExist)
    },
  },
  init: async (value, schema, error) => {
    let type: string
    const target: BasedSetTarget = {
      type,
      schema,
      required: [],
      collected: [],
      errors: [],
    }
    if (value.$id) {
      if (value.$id === 'root') {
        type = 'root'
      } else {
        type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
      }
      if (!type) {
        error(ParseError.incorrectFieldType, { target })
        return
      }
    }
    if (value.type) {
      if (type && value.type !== type) {
        error(ParseError.incorrectNodeType, { target })
        return
      }
      type = value.type
    }
    const typeSchema = type === 'root' ? schema.root : schema.types[type]
    if (!typeSchema) {
      error(ParseError.incorrectNodeType, { target })
      return
    }
    return { target, typeSchema }
  },
  error: (code, args) => {
    args.target.errors.push({
      code,
      path: args.path ?? [],
    })
  },
  collect: (args) => {
    args.root.target.collected.push(args)
  },
}

export const setWalker2 = (
  schema: BasedSchema,
  value: any
): Promise<BasedSetTarget> => walk<BasedSetTarget>(schema, opts, value)
