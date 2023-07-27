import { ParseError } from '../set/error'
import { BasedSchema, BasedSetTarget } from '../types'
import { walk } from '../walker'
import { array } from './array'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepEqual } from '@saulx/utils'

// add required
// add method to handle $value and $default easy

export const setWalker2 = (schema: BasedSchema, value: any) => {
  return walk<BasedSetTarget>(
    {
      schema,
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
            args.stop()
            return args
          },
        },
        fields: {
          array,
          object: async (args) => {
            if (typeof value !== 'object') {
              args.error(args, ParseError.incorrectFormat)
              return
            }
            const isArray = Array.isArray(value)
            if (isArray) {
              args.error(args, ParseError.incorrectFormat)
              return
            }
            return args
          },
          cardinality: async (args) => {
            const { value, error } = args
            let hashedValue: string
            if (value && typeof value === 'object') {
              if (value.$default !== undefined) {
                error(args, ParseError.defaultNotSupported)
                return
              }
              if (value.$value !== undefined) {
                hashedValue = hashObjectIgnoreKeyOrder(value.$value).toString(
                  16
                )
              } else {
                hashedValue = hashObjectIgnoreKeyOrder(value).toString(16)
              }
            } else {
              hashedValue = hash(value).toString(16)
            }
            args.collect(args, hashedValue)
          },
          boolean: async (args) => {
            if (typeof args.value !== 'boolean') {
              args.error(args, ParseError.incorrectFormat)
              return
            }
            args.collect(args)
          },
          enum: async (args) => {
            const { fieldSchema, error, collect, value } = args
            const enumValues = fieldSchema.enum
            for (let i = 0; i < enumValues.length; i++) {
              if (deepEqual(enumValues[i], value)) {
                collect(args, i)
                return
              }
            }
            error(args, ParseError.incorrectFormat)
          },
        },
        catch: async (args) => {
          args.error(args, ParseError.fieldDoesNotExist)
        },
      },
      init: async (args) => {
        const { value } = args
        let type: string
        if (value.$id) {
          type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
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
        const typeSchema = schema.types[type]
        if (!typeSchema) {
          args.error(args, ParseError.incorrectNodeType)
          return
        }
        const target: BasedSetTarget = {
          type,
          schema,
          required: [],
        }
        return { ...args, target, typeSchema }
      },
      collect: (args, value) => {
        if (args.key === '$default') {
          console.info('COLLECT!', args.path.slice(0, -1).join('.'), {
            $default: value,
          })
        } else {
          console.info('COLLECT!', args.path.join('.'), value)
        }
      },
    },
    value
  )
}
