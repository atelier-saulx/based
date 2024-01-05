import { ParseError } from '../error'
import { BasedSchema, BasedSchemaCollectProps, BasedSetTarget } from '../types.js'
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
      $merge: async (args) => {
        if (typeof args.value !== 'boolean') {
          args.error(ParseError.incorrectFormat)
          return
        }

        if (args.prev !== args.root) {
          args.prev.collect({ $delete: true })
        }

        return
      },
      $id: async (args) => {
        if (!isValidId(args.schema, args.value)) {
          args.error(ParseError.incorrectFormat)
          return
        }
      },
      $language: async (args) => {
        if (
          !(args.schema.translations || [])
            .concat(args.schema.language)
            .includes(args.value)
        ) {
          args.error(ParseError.languageNotSupported)
          return
        }
      },
      $value: async (args) => {
        const type = args.fieldSchema?.type
        if (type === 'text' || type === 'set' || type == 'references') {
          return
        }
        args.prev.stop()
        args.stop()
        if (args.prev.value.$default) {
          args.error(ParseError.valueAndDefault)
          return
        }
        return {
          path: args.path.slice(0, -1),
          value: args.value,
        }
      },
      $default: async (args) => {
        const type = args.fieldSchema?.type
        if (type === 'number' || type === 'integer' || type === 'text') {
          // default can exist with $incr and $decr
          return
        }
        args.prev.stop()
        args.stop()

        if (type === 'references' || type === 'set' || type === 'array') {
          const newArgs = args.create({
            path: args.path.slice(0, -1),
            skipCollection: true,
          })
          await newArgs.parse()
          newArgs.skipCollection = false
          newArgs.value = { $default: newArgs.value }
          newArgs.collect()
        } else {
          const collect = args._collectOverride ?? args.root._opts.collect
          const newArgs = args.create({
            path: args.path.slice(0, -1),
            collect: (a) => {
              if (a.path.length === args.path.length - 1) {
                collect(a.create({ value: { $default: a.value } }))
              } else {
                // console.info('hello', a.path) can handle this later
              }
            },
          })
          await newArgs.parse()
        }
        for (const key in args.prev.value) {
          if (key !== '$default') {
            args.prev.create({ key }).error(ParseError.fieldDoesNotExist)
          }
        }
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
        return { target }
      }
    } else if (value.$alias) {
      target.$alias = value.$alias
    }
    if (value.type) {
      if (type && value.type !== type) {
        error(ParseError.incorrectNodeType, { target })
        return { target }
      }
      type = value.type
    }
    const typeSchema = type === 'root' ? schema.root : schema.types[type]
    if (!typeSchema) {
      error(ParseError.incorrectNodeType, { target })
      return { target }
    }
    target.type = type
    target.$language = value.$language
    target.$id = value.$id
    if ('$merge' in value) {
      if (typeof value.$merge !== 'boolean') {
        error(ParseError.incorrectFormat, { target })
      }
      target.$merge = value.$merge
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
