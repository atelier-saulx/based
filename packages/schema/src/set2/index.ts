import { ParseError } from '../set/error'
import { BasedSchema, BasedSetTarget } from '../types'
import { walk } from '../walker'

export const setWalker2 = (schema: BasedSchema, value: any) => {
  return walk<BasedSetTarget>(
    {
      schema,
      parsers: {
        keys: {},
        fields: {
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
            const q: Promise<any>[] = []
            for (const key in value) {
              q.push(args.parse(args, key, value[key]))
            }
            await Promise.all(q)
          },
          boolean: async (args) => {
            if (typeof value !== 'boolean') {
              args.error(args, ParseError.incorrectFormat)
              return
            }
            args.collect(args)
          },
        },
        any: async (args) => {
          args.error(args, ParseError.fieldDoesNotExist)
        },
      },
      init: async (value, args) => {
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
        const schemaType = schema.types[type]
        if (!schemaType) {
          args.error(args, ParseError.incorrectNodeType)
          return
        }
        const target: BasedSetTarget = {
          type,
          schema,
          required: [],
        }
        return { ...args, target }
      },
    },
    value
  )
}