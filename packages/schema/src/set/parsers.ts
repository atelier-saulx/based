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
    error(path, ParseError.incorrectFormat)
  }

  if ('allowedTypes' in fieldSchema) {
    const prefix = value.slice(0, 2)
    const targetType = target.schema.prefixToTypeMapping[prefix]
    if (!targetType) {
      error(path, ParseError.referenceIsIncorrectType)
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
              error(path, ParseError.referenceIsIncorrectType)
            }
          }
        } else if (!t.type && t.$filter) {
          if (!(await handlers.referenceFilterCondition(value, t.$filter))) {
            error(path, ParseError.referenceIsIncorrectType)
          }
        }
      }
    }
    if (typeMatches === false) {
      error(path, ParseError.referenceIsIncorrectType)
    }
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
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
  reference,
  references: async (
    path,
    value,
    fieldSchema,
    typeSchema,
    target,
    handlers
  ) => {
    // default
    // $no root
    if (Array.isArray(value)) {
      const handler = {
        ...handlers,
        collect: () => {},
      }
      await Promise.all(
        value.map((v, i) => {
          return reference(
            [...path, i],
            v,
            // not nice slow
            { ...fieldSchema, type: 'reference' },
            typeSchema,
            target,
            handler
          )
        })
      )
      value = { $value: value }
    } else if (typeof value === 'object') {
      if (value.$add) {
        const handler = {
          ...handlers,
          collect: () => {},
        }
        await Promise.all(
          value.$add.map((v, i) => {
            return reference(
              [...path, '$add', i],
              v,
              // not nice slow
              { ...fieldSchema, type: 'reference' },
              typeSchema,
              target,
              handler
            )
          })
        )
      }
    }
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  },
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
  object: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (typeof value !== 'object') {
      error(path, ParseError.incorrectFormat)
    }
    const isArray = Array.isArray(value)
    if (isArray) {
      error(path, ParseError.incorrectFormat)
    }
    const q: Promise<void>[] = []
    for (const key in value) {
      const propDef = fieldSchema.properties[key]
      if (!propDef) {
        error([...path, key], ParseError.fieldDoesNotExist)
      }
      q.push(
        fieldWalker(
          [...path, key],
          value[key],
          propDef,
          typeSchema,
          target,
          handlers
        )
      )
    }
    await Promise.all(q)
  },
  array: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    const isArray = Array.isArray(value)
    if (typeof value === 'object' && !isArray) {
      const checkAssignOrInsert = async (type: string) => {
        if (
          typeof value[type] !== 'object' ||
          value.$insert.$idx === undefined
        ) {
          error([...path, type], ParseError.incorrectFormat)
        } else {
          await fieldWalker(
            [...path, type, '$value'],
            value.$value,
            fieldSchema,
            typeSchema,
            target,
            {
              ...handlers,
              collect: () => {},
            }
          )
        }
      }
      if (value.$insert) {
        await checkAssignOrInsert('$insert')
      }
      if (value.$remove && value.$remove.$idx === undefined) {
        error([...path, '$remove'], ParseError.incorrectFormat)
      }
      if (value.$push) {
        const q: Promise<void>[] = []
        const nestedHandler = {
          ...handlers,
          collect: () => {},
        }
        if (Array.isArray(value.$push)) {
          for (let i = 0; i < value.length; i++) {
            q.push(
              fieldWalker(
                [...path, i],
                value[i],
                fieldSchema.values,
                typeSchema,
                target,
                nestedHandler
              )
            )
          }
        } else {
          q.push(
            fieldWalker(
              [...path, '$push'],
              value.$push,
              fieldSchema.values,
              typeSchema,
              target,
              nestedHandler
            )
          )
        }
        await Promise.all(q)
      }
      if (value.$assign) {
        await checkAssignOrInsert('$assign')
      }
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
  json: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    try {
      const parsedValue = JSON.stringify(value)
      handlers.collect({
        path,
        value: parsedValue,
        typeSchema,
        fieldSchema,
        target,
      })
    } catch (err) {
      throw err(path, ParseError.incorrectFormat)
    }
  },
  // boolean
  boolean: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    // value .default
    // $increment / $decrement
    if (typeof value !== 'boolean') {
      error(path, ParseError.incorrectFormat)
    }
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  },
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
