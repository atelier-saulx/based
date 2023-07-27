import { ParseError } from '../set/error'
import { BasedSchema, BasedSetTarget } from '../types'
import { walk } from '../walker'

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
            // what do we want from this
            return args
          },
          $default: async () => {
            //
          },
        },
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
            return args
          },
          array: async (args) => {
            const { value, error, parse, fieldSchema } = args
            let isArray = Array.isArray(value)
            let parsedValue = value
            let opCount = 0
            let has$Value = false
            if (typeof parsedValue === 'object' && !isArray) {
              if (value.$value) {
                opCount++
                has$Value = true
                parsedValue = value.$value
                isArray = Array.isArray(parsedValue)
              }
              if (value.$insert) {
                opCount++
                if (opCount > 1) {
                  error(args, ParseError.multipleOperationsNotAllowed)
                  return
                }
                if (
                  typeof value.$insert !== 'object' ||
                  value.$insert.$idx === undefined
                ) {
                  error(args, ParseError.incorrectFormat)
                  return
                } else {
                  const insert = Array.isArray(value.$insert.$value)
                    ? value.$insert.$value
                    : [value.$insert.$value]
                  const q: Promise<any>[] = []
                  for (let i = 0; i < insert.length; i++) {
                    q.push(parse(args, i, insert[i], fieldSchema.values, true))
                  }
                  await Promise.all(q)
                }
              }
              if (value.$remove) {
                opCount++
                if (opCount > 1) {
                  error(args, ParseError.multipleOperationsNotAllowed)
                  return
                }
                if (value.$remove.$idx === undefined) {
                  error(args, ParseError.incorrectFormat)
                  return
                }
              }
              if (value.$push) {
                opCount++
                if (opCount > 1) {
                  error(args, ParseError.multipleOperationsNotAllowed)
                  return
                }
                const q: Promise<any>[] = []
                const push = Array.isArray(value.$push)
                  ? value.$push
                  : [value.$push]
                for (let i = 0; i < push.length; i++) {
                  q.push(parse(args, i, push[i], fieldSchema.values, true))
                }
                await Promise.all(q)
                parsedValue = { $push: push }
              }
              if (value.$unshift) {
                opCount++
                if (opCount > 1) {
                  error(args, ParseError.multipleOperationsNotAllowed)
                  return
                }
                const q: Promise<any>[] = []
                const unshift = Array.isArray(value.$unshift)
                  ? value.$unshift
                  : [value.$unshift]
                for (let i = 0; i < unshift.length; i++) {
                  q.push(parse(args, i, unshift[i], fieldSchema.values, true))
                }
                await Promise.all(q)
                parsedValue = { $unshift: unshift }
              }
              if (value.$assign) {
                opCount++
                if (opCount > 1) {
                  error(args, ParseError.multipleOperationsNotAllowed)
                  return
                }
                if (
                  typeof value.$assign !== 'object' ||
                  typeof value.$assign.$idx !== 'number'
                ) {
                  error(args, ParseError.incorrectFormat)
                  return
                }
                await parse(args, value.$assign.$idx, fieldSchema.values)
                return
              }
              if (!has$Value && !args.skipCollection) {
                handlers.collect({
                  path,
                  value: parsedValue,
                  typeSchema,
                  fieldSchema,
                  target,
                })
              }
              if (!has$Value) {
                return
              }
            }
            if (!isArray) {
              error(args, ParseError.incorrectFieldType)
              return
            }
            const q: Promise<void>[] = []
            const collector: any[] = []
            const nHandler = noCollect
              ? handlers
              : {
                  ...handlers,
                  collect: (collect) => {
                    collector.push(collect)
                  },
                }
            for (let i = 0; i < parsedValue.length; i++) {
              q.push(
                fieldWalker(
                  [...path, i],
                  parsedValue[i],
                  fieldSchema.values,
                  typeSchema,
                  target,
                  nHandler,
                  noCollect
                )
              )
            }

            await Promise.all(q)

            if (!noCollect) {
              handlers.collect({
                path,
                typeSchema,
                fieldSchema,
                target,
                value: { $delete: true },
              })
              for (const c of collector) {
                handlers.collect(c)
              }
            }
          },
          boolean: async (args) => {
            if (typeof args.value !== 'boolean') {
              args.error(args, ParseError.incorrectFormat)
              return
            }
            args.collect(args)
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
      collect: (args) => {
        console.info('COLLECT!', args.path.join('.'), args.value)
      },
    },
    value
  )
}
