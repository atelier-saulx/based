import { ParseError } from '../set/error'
import { BasedSchema, BasedSetTarget } from '../types'
import { walk } from '../walker'
import { fields } from './fields'

const parsers = {
  parsers: {
    keys: {
      $id: async (args) => {
        if (typeof args.value !== 'string') {
          args.error(args, ParseError.incorrectFormat)
          return
        }
        if (args.value.length > 10) {
          args.error(args, ParseError.incorrectFormat)
        }
      },
      $value: async (args) => {
        args.stop()
        if (args.parentValue.$default) {
          args.error(args, ParseError.valueAndDefault)
          return
        }
        return { ...args, path: args.path.slice(0, -1) }
      },
      $default: async (args) => {
        return
      },
    },
    fields,
    catch: async (args) => {
      args.error(args, ParseError.fieldDoesNotExist)
    },
  },
  init: async (args) => {
    const { value } = args
    let type: string
    if (value.$id) {
      type = args.schema.prefixToTypeMapping[value.$id.slice(0, 2)]
      if (!type) {
        args.error(args, ParseError.incorrectFieldType)
        return
      }
    }
    if (value.type) {
      if (type && value.type !== type) {
        args.error(args, ParseError.incorrectNodeType)
        return
      }
      type = value.type
    }
    const typeSchema = args.schema.types[type]
    if (!typeSchema) {
      args.error(args, ParseError.incorrectNodeType)
      return
    }
    const target: BasedSetTarget = {
      type,
      schema: args.schema,
      required: [],
    }
    return { ...args, target, typeSchema }
  },
  collect: (args, value) => {
    if (args.key === '$default') {
      if (Object.keys(args.parentValue).length > 1) {
        args.parentValue.$default = value
      } else {
        console.info('COLLECT! DEFAULT', args.path.slice(0, -1).join('.'), {
          $default: value,
        })
      }
    } else {
      console.info('COLLECT!', args.path.join('.'), JSON.stringify(value))
    }
  },
}

// TODO: make the opts outside of this
export const setWalker2 = (schema: BasedSchema, value: any) => {
  return walk<BasedSetTarget>(schema, parsers, value)
}
