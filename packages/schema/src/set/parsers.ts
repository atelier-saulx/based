import { deepEqual } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { error, ParseError } from './error'
import { Parsers } from './types'
import * as references from './references'
import * as collections from './collections'
import { enumParser, boolean, cardinality, json } from './rest'

const parsers: Parsers = {
  // numbers
  number: async (path, value, fieldSchema) => {},
  integer: async (path, value, fieldSchema) => {},
  timestamp: async (path, value, fieldSchema) => {},
  // string
  string: async (path, value, fieldSchema) => {},
  text: async (path, value, fieldSchema) => {},

  ...references,
  ...collections,
  enum: enumParser,
  boolean,
  cardinality,
  json,
}

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

export default parsers
