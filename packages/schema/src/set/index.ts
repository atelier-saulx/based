import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSchema,
  BasedSchemaLanguage,
  isCollection,
} from '../types'
import { deepEqual } from '@saulx/utils'
import { createError } from './handleError'

// Collect is a pretty good place for checking if a user is allowed to set something
// also make collect async

const fieldWalker = (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaField,
  typeSchema: BasedSchemaType,
  target: Target,
  collect: (
    path: (string | number)[],
    value: any, // parsed value
    typeSchema: BasedSchemaType,
    fieldSchema: BasedSchemaField,
    target: Target
  ) => void
) => {
  if ('$ref' in fieldSchema) {
    // TODO: when we have this it has to get it from the schema and redo the parsing with the correct fieldSchema
    return
  }

  const valueType = typeof value

  const valueIsObject = value && valueType === 'object'

  if (valueIsObject && value.$delete === true) {
    collect(path, value, typeSchema, fieldSchema, target)
    return
  }

  if ('enum' in fieldSchema) {
    const enumValues = fieldSchema.enum
    for (let i = 0; i < enumValues.length; i++) {
      if (deepEqual(enumValues[i], value)) {
        collect(path, i, typeSchema, fieldSchema, target)
        return
      }
    }
    throw createError(path, target.type, 'enum', value)
  }

  if ('type' in fieldSchema && isCollection(fieldSchema.type)) {
    const typeDef = fieldSchema.type

    const isArray = Array.isArray(value)

    if (typeDef === 'array') {
      if (!isArray) {
        throw createError(path, target.type, fieldSchema.type, value)
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
      return
    } else if (isArray) {
      throw createError(path, target.type, fieldSchema.type, value)
    }

    if (valueType !== 'object') {
      throw createError(path, target.type, fieldSchema.type, value)
    }

    for (const key in value) {
      // @ts-ignore
      const propDef = fieldSchema.properties[key]
      if (!propDef) {
        throw createError(
          [...path, key],
          target.type,
          fieldSchema.type,
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
    return
  }

  if ('type' in fieldSchema) {
    const typeDef = fieldSchema.type

    if (typeDef === 'set') {
      if (Array.isArray(value)) {
        const parsedArray = []
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
      return
    }

    if (typeDef === 'json') {
      try {
        const parsedValue = JSON.stringify(value)
        collect(path, parsedValue, typeSchema, fieldSchema, target)
        return
      } catch (err) {
        throw createError(path, target.type, fieldSchema.type, value)
      }
    }

    if (
      (typeDef === 'number' || typeDef === 'integer') &&
      valueType !== 'number'
    ) {
      throw createError(path, target.type, fieldSchema.type, value)
    }

    if (typeDef === 'integer' && value - Math.floor(value) !== 0) {
      throw createError(path, target.type, fieldSchema.type, value)
    }

    if (typeDef === 'string') {
      if (valueType !== 'string') {
        throw createError(path, target.type, fieldSchema.type, value)
      }

      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        throw createError(path, target.type, fieldSchema.type, value)
      }

      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        throw createError(path, target.type, fieldSchema.type, value)
      }
    }

    if (typeDef === 'text') {
      if (target.$language && valueType === 'string') {
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          throw createError(path, target.type, fieldSchema.type, value)
        }

        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          throw createError(path, target.type, fieldSchema.type, value)
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
        throw createError(path, target.type, fieldSchema.type, value)
      }

      for (const key in value) {
        if (
          fieldSchema.minLength &&
          value[key].length < fieldSchema.minLength
        ) {
          throw createError(
            [...path, key],
            target.type,
            fieldSchema.type,
            value
          )
        }

        if (
          fieldSchema.maxLength &&
          value[key].length > fieldSchema.maxLength
        ) {
          throw createError(
            [...path, key],
            target.type,
            fieldSchema.type,
            value
          )
        }

        if (typeof value[key] === 'object' && value[key].$delete === true) {
          collect([...path, key], null, typeSchema, fieldSchema, target)
          continue
        }

        if (typeof value[key] !== 'string') {
          throw createError(
            [...path, key],
            target.type,
            fieldSchema.type,
            value
          )
        }

        collect([...path, key], value[key], typeSchema, fieldSchema, target)
      }
      return
    }

    collect(path, value, typeSchema, fieldSchema, target)

    return
  }
}

type Target = {
  type: string
  $alias?: string
  $id?: string
  $language?: BasedSchemaLanguage
}

export const setWalker = (
  schema: BasedSchema,
  value: { [key: string]: any },
  collect: (
    path: (string | number)[],
    value: any, // parsed value
    typeSchema: BasedSchemaType,
    fieldSchema: BasedSchemaField,
    target: Target
  ) => void
): Target => {
  let type: string

  if (value.$id) {
    type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
    if (!type) {
      throw new Error(`Cannot find type for $id ${value.$id}`)
    }
  }

  if (value.type) {
    if (type && value.type !== type) {
      throw new Error(
        `type from "$id" ${value.$id} does not match "type" field ${value.type}`
      )
    }
    type = value.type
  }

  const schemaType = schema.types[type]

  if (!schemaType) {
    throw new Error(`Cannot find schema definition for type ${type}`)
  }

  const target: Target = {
    type,
  }

  if (value.$id) {
    target.$id = value.$id
  } else if (value.$alias) {
    target.$alias = value.$alias
  }

  for (const key in value) {
    if (key[0] === '$') {
      console.info('key is operator', key)
    } else {
      const fieldSchema = schemaType.fields[key]
      if (!fieldSchema) {
        throw new Error(
          `Field does not exist in schema "${key}" on type "${type}"`
        )
      } else {
        fieldWalker([key], value[key], fieldSchema, schemaType, target, collect)
      }
    }
  }

  return target
}
