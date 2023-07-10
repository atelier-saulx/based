import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSchema,
  BasedSchemaLanguage,
  BasedSetTarget,
} from '../types'
import { deepEqual } from '@saulx/utils'
import { createError } from './handleError'
import { fieldWalker } from '.'

const fieldValidator: {
  [key: string]: (
    path: (string | number)[],
    value: any,
    fieldSchema: BasedSchemaField,
    typeSchema: BasedSchemaType,
    target: BasedSetTarget,
    collect: (
      path: (string | number)[],
      value: any, // parsed value
      typeSchema: BasedSchemaType,
      fieldSchema: BasedSchemaField,
      target: BasedSetTarget
    ) => void
  ) => void
} = {
  enum: (path, value, fieldSchema, typeSchema, target, collect) => {
    // @ts-ignore
    const enumValues = fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], value)) {
        collect(path, i, typeSchema, fieldSchema, target)
        return
      }
    }
    throw createError(path, target.type, 'enum', value)
  },

  array: (path, value, fieldSchema, typeSchema, target, collect) => {
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
        collect
      )
    }
  },

  object: (path, value, fieldSchema, typeSchema, target, collect) => {
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
        collect
      )
    }
  },

  set: (path, value, fieldSchema, typeSchema, target, collect) => {
    if (Array.isArray(value)) {
      const parsedArray = []
      //   @ts-ignore
      const fieldDef = fieldSchema.items
      for (let i = 0; i < value.length; i++) {
        fieldWalker(
          [...path, i],
          value[i],
          fieldDef,
          typeSchema,
          target,
          (path, value) => {
            parsedArray.push(value)
          }
        )
      }
      collect(path, parsedArray, typeSchema, fieldSchema, target)
    } else {
      // TODO PARSE IF VALID
      // $add / $remove
      collect(path, value, typeSchema, fieldSchema, target)
    }
  },

  json: (path, value, fieldSchema, typeSchema, target, collect) => {
    try {
      const parsedValue = JSON.stringify(value)
      collect(path, parsedValue, typeSchema, fieldSchema, target)
    } catch (err) {
      throw createError(path, target.type, 'json', value)
    }
  },

  number: (path, value, fieldSchema, typeSchema, target, collect) => {
    if (typeof value !== 'number') {
      throw createError(path, target.type, 'number', value)
    }
    collect(path, value, typeSchema, fieldSchema, target)
  },

  integer: (path, value, fieldSchema, typeSchema, target, collect) => {
    if (typeof value !== 'number' || value - Math.floor(value) !== 0) {
      throw createError(path, target.type, 'integer', value)
    }
    collect(path, value, typeSchema, fieldSchema, target)
  },

  string: (path, value, fieldSchema, typeSchema, target, collect) => {
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
    collect(path, value, typeSchema, fieldSchema, target)
  },

  text: (path, value, fieldSchema, typeSchema, target, collect) => {
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

      collect(
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
        collect([...path, key], null, typeSchema, fieldSchema, target)
        continue
      }

      if (typeof value[key] !== 'string') {
        throw createError([...path, key], target.type, 'text', value)
      }

      collect([...path, key], value[key], typeSchema, fieldSchema, target)
    }
  },

  references: (path, value, fieldSchema, typeSchema, target, collect) => {
    collect(path, value, typeSchema, fieldSchema, target)
  },

  reference: (path, value, fieldSchema, typeSchema, target, collect) => {
    collect(path, value, typeSchema, fieldSchema, target)
  },
}

export default fieldValidator
