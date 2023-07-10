import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSetHandlers,
  BasedSchema,
  BasedSetTarget,
} from '../types'
import { createError } from './handleError'
import parsers from './parsers'

// Collect is a pretty good place for checking if a user is allowed to set something
// also make collect async

// add extra function for loading required

export const fieldWalker = async (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaField,
  typeSchema: BasedSchemaType,
  target: BasedSetTarget,
  handlers: BasedSetHandlers
): Promise<void> => {
  if ('$ref' in fieldSchema) {
    // TODO: when we have this it has to get it from the schema and redo the parsing with the correct fieldSchema
    return
  }
  const valueType = typeof value

  const valueIsObject = value && valueType === 'object'
  if (valueIsObject && value.$delete === true) {
    handlers.collect(path, value, typeSchema, fieldSchema, target)
    return
  }

  const typeDef =
    'type' in fieldSchema
      ? fieldSchema.type
      : 'enum' in fieldSchema
      ? 'enum'
      : ''

  if (!typeDef) {
    throw createError(path, target.type, typeDef, path[path.length - 1])
  }

  if ('customValidator' in fieldSchema) {
    const customValidator = fieldSchema.customValidator
    if (!(await customValidator(value, path, target))) {
      throw createError(path, target.type, typeDef, value)
    }
  }

  const parse = parsers[typeDef]
  await parse(path, value, fieldSchema, typeSchema, target, handlers)

  return
}

export const setWalker = async (
  schema: BasedSchema,
  value: { [key: string]: any },
  handlers: BasedSetHandlers
): Promise<BasedSetTarget> => {
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

  const target: BasedSetTarget = {
    type,
    schema,
  }

  if (value.$id) {
    target.$id = value.$id
  } else if (value.$alias) {
    target.$alias = value.$alias
  }

  const q: Promise<void>[] = []

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
        q.push(
          fieldWalker(
            [key],
            value[key],
            fieldSchema,
            schemaType,
            target,
            handlers
          )
        )
      }
    }
  }

  await Promise.all(q)

  // required fields (collect them!)
  //   if (!(await handlers.requiredFields(value, [], target))) {
  //     throw new Error('Missing required fields')
  //   }

  return target
}
