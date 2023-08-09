import { ParseError } from '../error'
import { BasedSchema, BasedSchemaCollectProps, BasedSetTarget } from '../types'
import { walk, Opts, AsyncOperation } from '../walker'
import { fields } from './fields'
import { isValidId } from './isValidId'

const opts: Opts<BasedSetTarget> = {
  parsers: {
    keys: {
      $delete: async (args) => {
        if (args.prev === args.root) {
          args.error(ParseError.cannotDeleteNodeFromModify)
          return
        }
        if (args.value === true) {
          args.stop()
          args.prev.collect()
          args.prev.stop()
          return
        }
      },
      $alias: async (args) => {
        if (Array.isArray(args.value)) {
          for (const field of args.value) {
            if (typeof field !== 'string') {
              args.error(ParseError.incorrectFormat)
              return
            }
          }
          return
        }
        if (typeof args.value !== 'string') {
          args.error(ParseError.incorrectFormat)
        }
      },
      $id: async (args) => {
        if (!isValidId(args.schema, args.value)) {
          args.error(ParseError.incorrectFormat)
          return
        }
      },
      $language: async (args) => {
        if (!args.schema.languages.includes(args.value)) {
          args.error(ParseError.languageNotSupported)
          return
        }
      },
      $value: async (args) => {
        const type = args.fieldSchema?.type
        if (type === 'text') {
          return
        }
        args.stop()
        if (args.prev.value.$default) {
          args.error(ParseError.valueAndDefault)
          return
        }
        return { path: args.path.slice(0, -1) }
      },
      $default: async (args) => {
        const type = args.fieldSchema?.type
        if (type === 'number' || type === 'integer' || type === 'text') {
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
    } else if (value.$alias) {
      target.$alias = value.$alias
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
    target.type = type
    target.$language = value.$language
    target.$id = value.$id
    return { target, typeSchema }
  },
  error: (code, args) => {
    args.target.errors.push({
      code,
      path: args.path ?? [],
    })
  },
  collect: (args) => {
    args.root.target.collected.push(<BasedSchemaCollectProps>args)
  },
}

export const setWalker = (
  schema: BasedSchema,
  value: any,
  asyncOperationHandler?: AsyncOperation<BasedSetTarget>
): Promise<BasedSetTarget> => {
  return walk<BasedSetTarget>(schema, opts, value, asyncOperationHandler)
}
