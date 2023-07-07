import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSchema,
  BasedSchemaLanguage,
  isCollection,
} from './types'

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

  if (value && valueType === 'object' && value.$delete === true) {
    collect(path, value, typeSchema, fieldSchema, target)
    return
  }

  if ('type' in fieldSchema && isCollection(fieldSchema.type)) {
    const typeDef = fieldSchema.type

    const isArray = Array.isArray(value)

    if (typeDef === 'array') {
      if (!isArray) {
        throw new Error(
          `Type: "${target.type}" Field: "${path.join(
            '.'
          )}" is not of type "array"`
        )
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
      throw new Error(
        `Type: "${target.type}" Field: "${path.join(
          '.'
        )}" is not of type "${typeDef}"`
      )
    }

    if (valueType !== 'object') {
      throw new Error(
        `Type: "${target.type}" Field: "${path.join(
          '.'
        )}" is not of type "${typeDef}"`
      )
    }

    for (const key in value) {
      // @ts-ignore
      const propDef = fieldSchema.properties[key]
      if (!propDef) {
        throw new Error(
          `Field does not exist in schema "${[...path, key].join(
            '.'
          )}" on type "${target.type}"`
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

    if (
      (typeDef === 'number' || typeDef === 'integer') &&
      valueType !== 'number'
    ) {
      throw new Error(
        `${value} is not a number "${path.join('.')}" on type "${target.type}"`
      )
    }

    if (typeDef === 'integer' && value - Math.floor(value) !== 0) {
      throw new Error(
        `${value} is not an integer "${path.join('.')}" on type "${
          target.type
        }"`
      )
    }

    if (typeDef === 'string' && valueType !== 'string') {
      throw new Error(
        `${value} is not a string "${path.join('.')}" on type "${target.type}"`
      )
    }

    if (typeDef === 'text') {
      if (target.$language && valueType === 'string') {
        collect(path, value, typeSchema, fieldSchema, target)
      }

      if (valueType !== 'object') {
        throw new Error(
          `${value} is not a language object "${path.join('.')}" on type "${
            target.type
          }"`
        )
      }

      for (const key in value) {
        if (typeof value[key] === 'object' && value[key].$delete === true) {
          collect([...path, key], null, typeSchema, fieldSchema, target)
          continue
        }

        if (typeof value[key] !== 'string') {
          throw new Error(
            `${value} is not a string "${[...path, key].join('.')}" on type "${
              target.type
            }"`
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
