import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSchema,
  BasedSchemaLanguage,
} from './types'

const fieldWalker = (
  path: string[],
  value: any,
  fieldSchema: BasedSchemaField,
  typeSchema: BasedSchemaType,
  target: Target,
  collect: (
    path: string,
    value: any, // parsed value
    typeSchema: BasedSchemaType,
    fieldSchema: BasedSchemaField,
    target: Target
  ) => void
) => {
  console.log('flap')
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
    path: string,
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

  const schemaType = schema[type]

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
