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
        return
      },
    },
    fields,
    catch: async (args) => {
      args.error(ParseError.fieldDoesNotExist)
    },
  },
  init: async (value, schema, error) => {
    let type: string
    if (value.$id) {
      type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
      if (!type) {
        error(ParseError.incorrectFieldType)
        return
      }
    }
    if (value.type) {
      if (type && value.type !== type) {
        error(ParseError.incorrectNodeType)
        return
      }
      type = value.type
    }
    const typeSchema = schema.types[type]
    if (!typeSchema) {
      error(ParseError.incorrectNodeType)
      return
    }
    const target: BasedSetTarget = {
      type,
      schema,
      required: [],
    }

    return { target, typeSchema }
  },
  collect: (args, value) => {
    if (args.key === '$default') {
      if (Object.keys(args.prev.value).length > 1) {
        args.prev.value.$default = value
      } else {
        console.info('COLLECT! DEFAULT', args.path.slice(0, -1).join('.'), {
          $default: value,
        })
      }
    } else {
      console.info('COLLECT!', args.path.join('.'), value)
    }
  },
}

// TODO: make the opts outside of this
export const setWalker2 = (schema: BasedSchema, value: any) => {
  return walk<BasedSetTarget>(schema, opts, value)
}
