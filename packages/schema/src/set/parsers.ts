import {
  BasedSchemaType,
  BasedSetHandlers,
  BasedSetTarget,
  BasedSchemaFields,
} from '../types'
import { deepEqual } from '@saulx/utils'
import { fieldWalker } from '.'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { error, ParseError } from './error'

type Parser<K extends keyof BasedSchemaFields> = (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaFields[K],
  typeSchema: BasedSchemaType,
  target: BasedSetTarget,
  handlers: BasedSetHandlers
) => Promise<void>

type Parsers = {
  [Key in keyof BasedSchemaFields]: Parser<Key>
}

const parsers: Parsers = {
  // numbers
  number: async (path, value, fieldSchema) => {},
  integer: async (path, value, fieldSchema) => {},
  timestamp: async (path, value, fieldSchema) => {},
  // string
  string: async (path, value, fieldSchema) => {},
  text: async (path, value, fieldSchema) => {},
  // cardinality
  cardinality: async (
    path,
    value,
    fieldSchema,
    typeSchema,
    target,
    handlers
  ) => {
    if (value && typeof value === 'object') {
      value = hashObjectIgnoreKeyOrder(value).toString(16)
    } else {
      value = hash(value).toString(16)
    }
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  },
  // references
  reference: async (path, value, fieldSchema) => {},
  references: async (path, value, fieldSchema) => {},
  // collections
  set: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    const q: Promise<void>[] = []
    const fieldDef = fieldSchema.items
    if (Array.isArray(value)) {
      const handlerNest = {
        ...handlers,
        collect: ({ value }) => {
          parsedArray.push(value)
        },
      }
      const parsedArray = []
      for (let i = 0; i < value.length; i++) {
        q.push(
          fieldWalker(
            [...path, i],
            value[i],
            fieldDef,
            typeSchema,
            target,
            handlerNest
          )
        )
      }
      await Promise.all(q)
      handlers.collect({
        path,
        value: { $value: parsedArray },
        typeSchema,
        fieldSchema,
        target,
      })
    } else {
      const handlerNest = {
        ...handlers,
        collect: () => {},
      }
      if (value.$add) {
        for (let i = 0; i < value.$add.length; i++) {
          q.push(
            fieldWalker(
              [...path, '$add', i],
              value.$add[i],
              fieldDef,
              typeSchema,
              target,
              handlerNest
            )
          )
        }
      }
      if (value.$delete) {
        for (let i = 0; i < value.$add.length; i++) {
          q.push(
            fieldWalker(
              [...path, '$delete', i],
              value.$delete[i],
              fieldDef,
              typeSchema,
              target,
              handlerNest
            )
          )
        }
      }
      await Promise.all(q)
      handlers.collect({ path, value, typeSchema, fieldSchema, target })
    }
  },
  object: async (path, value, fieldSchema) => {},
  array: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    const isArray = Array.isArray(value)

    if (typeof value === 'object' && !isArray) {
      const q: Promise<void>[] = []

      if (value.$insert) {
        if (typeof value.$insert !== 'object') {
          
        }
      }

      if (value.$remove) {
      }

      if (value.$push) {
      }

      if (value.$assign) {
      }

      // value.$value :/
      // fix
      handlers.collect({ path, value, typeSchema, fieldSchema, target })

      return
    }

    if (!isArray) {
      error(path, ParseError.incorrectFieldType)
    }

    const q: Promise<void>[] = []
    for (let i = 0; i < value.length; i++) {
      q.push(
        fieldWalker(
          [...path, i],
          value[i],
          fieldSchema.values,
          typeSchema,
          target,
          handlers
        )
      )
    }
    await Promise.all(q)
  },
  record: async (path, value, fieldSchema) => {},
  // json
  json: async (path, value, fieldSchema) => {},
  // boolean
  boolean: async (path, value, fieldSchema) => {},
  // enum
  enum: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    const enumValues = fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], value)) {
        handlers.collect({ path, value: i, typeSchema, fieldSchema, target })
        return
      }
    }
    error(path, ParseError.incorrectFormat)
  },
}

/*

const reference: Parser<'reference'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  // $no root

  // prob pass these as options
  // value .default
  // $value

  if (typeof value !== 'string') {
    throw createError(path, target.type, 'reference', value)
  }

  if ('allowedTypes' in fieldSchema) {
    const prefix = value.slice(0, 2)
    const targetType = target.schema.prefixToTypeMapping[prefix]
    if (!targetType) {
      throw createError(
        path,
        target.type,
        'reference',
        value,
        '',
        `${prefix} does not exist in database`
      )
    }
    let typeMatches = false
    for (const t of fieldSchema.allowedTypes) {
      if (typeof t === 'string') {
        if (t === targetType) {
          typeMatches = true
          break
        }
      } else {
        if (t.type && t.type === targetType) {
          typeMatches = true
          if (t.$filter) {
            if (!(await handlers.referenceFilterCondition(value, t.$filter))) {
              throw createError(
                path,
                target.type,
                'reference',
                value,
                '',
                `${targetType} does not match allowedReferences`
              )
            }
          }
        } else if (!t.type && t.$filter) {
          if (!(await handlers.referenceFilterCondition(value, t.$filter))) {
            throw createError(
              path,
              target.type,
              'reference',
              value,
              '',
              `${targetType} does not match allowedReferences`
            )
          }
        }
      }
    }
    if (typeMatches === false) {
      throw createError(
        path,
        target.type,
        'reference',
        value,
        '',
        `${targetType} does not match allowedReferences`
      )
    }
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}
*/

// {

//   [key: string]: Parser
// } = {
//

//   object: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // value .default

//     if (typeof value !== 'object') {
//       throw createError(path, target.type, 'object', value)
//     }
//     const isArray = Array.isArray(value)
//     if (isArray) {
//       throw createError(path, target.type, 'object', value)
//     }
//     const q: Promise<void>[] = []
//     for (const key in value) {
//       // @ts-ignore
//       const propDef = fieldSchema.properties[key]
//       if (!propDef) {
//         throw createError(
//           [...path, key],
//           target.type,
//           'object',
//           value[key],
//           key
//         )
//       }
//       q.push(
//         fieldWalker(
//           [...path, key],
//           value[key],
//           propDef,
//           typeSchema,
//           target,
//           handlers
//         )
//       )
//     }
//     await Promise.all(q)
//   },

//   set: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // value .default

//     const q: Promise<void>[] = []
//     //   @ts-ignore
//     const fieldDef = fieldSchema.items

//     if (Array.isArray(value)) {
//       const handlerNest = {
//         ...handlers,
//         collect: ({ path, value }) => {
//           parsedArray.push(value)
//         },
//       }
//       const parsedArray = []
//       for (let i = 0; i < value.length; i++) {
//         q.push(
//           fieldWalker(
//             [...path, i],
//             value[i],
//             fieldDef,
//             typeSchema,
//             target,
//             handlerNest
//           )
//         )
//       }
//       await Promise.all(q)
//       handlers.collect({
//         path,
//         value: { $value: parsedArray },
//         typeSchema,
//         fieldSchema,
//         target,
//       })
//     } else {
//       const handlerNest = {
//         ...handlers,
//         collect: ({ path, value }) => {},
//       }
//       if (value.$add) {
//         for (let i = 0; i < value.$add.length; i++) {
//           q.push(
//             fieldWalker(
//               [...path, '$add', i],
//               value.$add[i],
//               fieldDef,
//               typeSchema,
//               target,
//               handlerNest
//             )
//           )
//         }
//       }
//       if (value.$delete) {
//         for (let i = 0; i < value.$add.length; i++) {
//           q.push(
//             fieldWalker(
//               [...path, '$delete', i],
//               value.$delete[i],
//               fieldDef,
//               typeSchema,
//               target,
//               handlerNest
//             )
//           )
//         }
//       }
//       await Promise.all(q)
//       handlers.collect({ path, value, typeSchema, fieldSchema, target })
//     }
//   },

//   json: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // value .default

//     try {
//       const parsedValue = JSON.stringify(value)
//       handlers.collect({
//         path,
//         value: parsedValue,
//         typeSchema,
//         fieldSchema,
//         target,
//       })
//     } catch (err) {
//       throw createError(path, target.type, 'json', value)
//     }
//   },

//   boolean: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // value .default
//     // $increment / $decrement

//     if (typeof value !== 'boolean') {
//       throw createError(path, target.type, 'boolean', value)
//     }
//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },

//   timestamp: async (
//     path,
//     value,
//     fieldSchema: BasedSchemaFieldTimeStamp,
//     typeSchema,
//     target,
//     handlers
//   ) => {
//     if (typeof value === 'string') {
//       if (value === 'now') {
//         value = Date.now()
//       } else {
//         const d = new Date(value)
//         value = d.valueOf()
//         if (isNaN(value)) {
//           throw createError(path, target.type, 'timestamp', value)
//         }
//       }
//     }

//     // smaller then / larger then steps
//     if (typeof value !== 'number') {
//       throw createError(path, target.type, 'timestamp', value)
//     }

//     if (fieldSchema.maximum) {
//       if (fieldSchema.exclusiveMaximum && value > value) {
//         throw createError(path, target.type, 'timestamp', value)
//       } else if (value >= value) {
//         throw createError(path, target.type, 'timestamp', value)
//       }
//     }

//     if (fieldSchema.minimum) {
//       if (fieldSchema.exclusiveMinimum && value < value) {
//         throw createError(path, target.type, 'timestamp', value)
//       } else if (value <= value) {
//         throw createError(path, target.type, 'timestamp', value)
//       }
//     }

//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },

//   number: async (
//     path,
//     value,
//     fieldSchema: BasedSchemaFieldNumber,
//     typeSchema,
//     target,
//     handlers
//   ) => {
//     // value .default
//     // $increment / $decrement

//     if (typeof value !== 'number') {
//       throw createError(path, target.type, 'number', value)
//     }

//     if (fieldSchema.maximum) {
//       if (fieldSchema.exclusiveMaximum && value > value) {
//         throw createError(path, target.type, 'number', value)
//       } else if (value >= value) {
//         throw createError(path, target.type, 'number', value)
//       }
//     }

//     if (fieldSchema.minimum) {
//       if (fieldSchema.exclusiveMinimum && value < value) {
//         throw createError(path, target.type, 'number', value)
//       } else if (value <= value) {
//         throw createError(path, target.type, 'number', value)
//       }
//     }

//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },

//   integer: async (
//     path,
//     value,
//     fieldSchema: BasedSchemaFieldInteger,
//     typeSchema,
//     target,
//     handlers
//   ) => {
//     // value .default
//     // $increment / $decrement

//     // smaller then / larger then steps

//     if (typeof value !== 'number' || value - Math.floor(value) !== 0) {
//       throw createError(path, target.type, 'integer', value)
//     }

//     if (fieldSchema.maximum) {
//       if (fieldSchema.exclusiveMaximum && value > value) {
//         throw createError(path, target.type, 'number', value)
//       } else if (value >= value) {
//         throw createError(path, target.type, 'number', value)
//       }
//     }

//     if (fieldSchema.minimum) {
//       if (fieldSchema.exclusiveMinimum && value < value) {
//         throw createError(path, target.type, 'number', value)
//       } else if (value <= value) {
//         throw createError(path, target.type, 'number', value)
//       }
//     }

//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },

//   string: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // default

//     if (typeof value !== 'string') {
//       throw createError(path, target.type, 'string', value)
//     }
//     // @ts-ignore
//     if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
//       throw createError(path, target.type, 'string', value)
//     }
//     // @ts-ignore
//     if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
//       throw createError(path, target.type, 'string', value)
//     }
//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },

//   text: async (path, value, fieldSchema, typeSchema, target, handlers) => {
//     // default

//     const valueType = typeof value
//     if (target.$language && valueType === 'string') {
//       // @ts-ignore
//       if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
//         throw createError(path, target.type, 'text', value)
//       }
//       // @ts-ignore
//       if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
//         throw createError(path, target.type, 'text', value)
//       }

//       handlers.collect({
//         path,
//         value: { [target.$language]: value },
//         typeSchema,
//         fieldSchema,
//         target,
//       })
//       return
//     }

//     if (valueType !== 'object') {
//       throw createError(path, target.type, 'text', value)
//     }

//     for (const key in value) {
//       // @ts-ignore
//       if (fieldSchema.minLength && value[key].length < fieldSchema.minLength) {
//         throw createError([...path, key], target.type, 'text', value)
//       }

//       // @ts-ignore
//       if (fieldSchema.maxLength && value[key].length > fieldSchema.maxLength) {
//         throw createError([...path, key], target.type, 'text', value)
//       }

//       if (typeof value[key] === 'object' && value[key].$delete === true) {
//         handlers.collect({
//           path: [...path, key],
//           value: null,
//           typeSchema,
//           fieldSchema,
//           target,
//         })
//         continue
//       }

//       if (typeof value[key] !== 'string') {
//         throw createError([...path, key], target.type, 'text', value)
//       }

//       handlers.collect({
//         path: [...path, key],
//         value: value[key],
//         typeSchema,
//         fieldSchema,
//         target,
//       })
//     }
//   },

//   reference,

//   references: async (
//     path,
//     value,
//     fieldSchema,
//     typeSchema,
//     target,
//     handlers
//   ) => {
//     // default
//     // $no root

//     if (Array.isArray(value)) {
//       const handler = {
//         ...handlers,
//         collect: () => {},
//       }
//       await Promise.all(
//         value.map((v, i) => {
//           return reference(
//             [...path, i],
//             v,
//             fieldSchema,
//             typeSchema,
//             target,
//             handler
//           )
//         })
//       )
//       value = { $value: value }
//     } else if (typeof value === 'object') {
//       if (value.$add) {
//         const handler = {
//           ...handlers,
//           collect: () => {},
//         }
//         await Promise.all(
//           value.$add.map((v, i) => {
//             return reference(
//               [...path, '$add', i],
//               v,
//               fieldSchema,
//               typeSchema,
//               target,
//               handler
//             )
//           })
//         )
//       }
//     }

//     handlers.collect({ path, value, typeSchema, fieldSchema, target })
//   },
// }

export default parsers
