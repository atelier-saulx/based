import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSetHandlers,
  BasedSetTarget,
} from '../types'
import { deepEqual } from '@saulx/utils'
import { createError } from './handleError'
import { fieldWalker } from '.'

type Parser = (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaField,
  typeSchema: BasedSchemaType,
  target: BasedSetTarget,
  handlers: BasedSetHandlers
) => Promise<void>

const reference: Parser = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
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
  handlers.collect(path, value, typeSchema, fieldSchema, target)
}

const parsers: {
  [key: string]: Parser
} = {
  enum: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    // @ts-ignore
    const enumValues = fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], value)) {
        handlers.collect(path, i, typeSchema, fieldSchema, target)
        return
      }
    }
    throw createError(path, target.type, 'enum', value)
  },

  array: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    // TODO: ADD OPERATORS
    const isArray = Array.isArray(value)
    if (!isArray) {
      throw createError(path, target.type, 'array', value)
    }
    for (let i = 0; i < value.length; i++) {
      fieldWalker(
        [...path, i],
        value[i],
        // @ts-ignore
        fieldSchema.values,
        typeSchema,
        target,
        handlers
      )
    }
  },

  object: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (typeof value !== 'object') {
      throw createError(path, target.type, 'object', value)
    }
    const isArray = Array.isArray(value)
    if (isArray) {
      throw createError(path, target.type, 'object', value)
    }
    for (const key in value) {
      // @ts-ignore
      const propDef = fieldSchema.properties[key]
      if (!propDef) {
        throw createError(
          [...path, key],
          target.type,
          'object',
          value[key],
          key
        )
      }
      fieldWalker(
        [...path, key],
        value[key],
        propDef,
        typeSchema,
        target,
        handlers
      )
    }
  },

  set: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (Array.isArray(value)) {
      const parsedArray = []
      //   @ts-ignore
      const fieldDef = fieldSchema.items
      for (let i = 0; i < value.length; i++) {
        fieldWalker([...path, i], value[i], fieldDef, typeSchema, target, {
          ...handlers,
          collect: (path, value) => {
            parsedArray.push(value)
          },
        })
      }
      handlers.collect(path, parsedArray, typeSchema, fieldSchema, target)
    } else {
      // TODO PARSE IF VALID
      // $add / $remove
      handlers.collect(path, value, typeSchema, fieldSchema, target)
    }
  },

  json: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    try {
      const parsedValue = JSON.stringify(value)
      handlers.collect(path, parsedValue, typeSchema, fieldSchema, target)
    } catch (err) {
      throw createError(path, target.type, 'json', value)
    }
  },

  number: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (typeof value !== 'number') {
      throw createError(path, target.type, 'number', value)
    }
    handlers.collect(path, value, typeSchema, fieldSchema, target)
  },

  integer: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (typeof value !== 'number' || value - Math.floor(value) !== 0) {
      throw createError(path, target.type, 'integer', value)
    }
    handlers.collect(path, value, typeSchema, fieldSchema, target)
  },

  string: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    if (typeof value !== 'string') {
      throw createError(path, target.type, 'string', value)
    }
    // @ts-ignore
    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      throw createError(path, target.type, 'string', value)
    }
    // @ts-ignore
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      throw createError(path, target.type, 'string', value)
    }
    handlers.collect(path, value, typeSchema, fieldSchema, target)
  },

  text: async (path, value, fieldSchema, typeSchema, target, handlers) => {
    const valueType = typeof value
    if (target.$language && valueType === 'string') {
      // @ts-ignore
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        throw createError(path, target.type, 'text', value)
      }
      // @ts-ignore
      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        throw createError(path, target.type, 'text', value)
      }

      handlers.collect(
        path,
        { [target.$language]: value },
        typeSchema,
        fieldSchema,
        target
      )
      return
    }

    if (valueType !== 'object') {
      throw createError(path, target.type, 'text', value)
    }

    for (const key in value) {
      // @ts-ignore
      if (fieldSchema.minLength && value[key].length < fieldSchema.minLength) {
        throw createError([...path, key], target.type, 'text', value)
      }

      // @ts-ignore
      if (fieldSchema.maxLength && value[key].length > fieldSchema.maxLength) {
        throw createError([...path, key], target.type, 'text', value)
      }

      if (typeof value[key] === 'object' && value[key].$delete === true) {
        handlers.collect([...path, key], null, typeSchema, fieldSchema, target)
        continue
      }

      if (typeof value[key] !== 'string') {
        throw createError([...path, key], target.type, 'text', value)
      }

      handlers.collect(
        [...path, key],
        value[key],
        typeSchema,
        fieldSchema,
        target
      )
    }
  },

  reference,

  references: async (
    path,
    value,
    fieldSchema,
    typeSchema,
    target,
    handlers
  ) => {
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
            fieldSchema,
            typeSchema,
            target,
            handler
          )
        })
      )
    } else if (typeof value === 'object') {
      const handler = {
        ...handlers,
        collect: () => {},
      }
      if (value.$add) {
        await Promise.all(
          value.$add.map((v, i) => {
            return reference(
              [...path, '$add', i],
              v,
              fieldSchema,
              typeSchema,
              target,
              handler
            )
          })
        )
      }
    }
    handlers.collect(path, value, typeSchema, fieldSchema, target)
  },
}

export default parsers
