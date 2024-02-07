import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaFieldPartial,
  BasedSchemaPartial,
} from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

const DEFAULT_FIELDS: any = {
  // id: { type: 'string' },
  // createdAt: { type: 'timestamp' },
  // updatedAt: { type: 'timestamp' },
  // type: { type: 'string' },
  // parents: { type: 'references' },
  // children: { type: 'references' },
  // ancestors: { type: 'references' },
  // descendants: { type: 'references' },
  // aliases: {
  //   type: 'set',
  //   items: { type: 'string' },
  // },
}

const metaParser = (obj) => {
  const metaObj = obj?.meta
  const tmp = {} as BasedSchemaFieldPartial | any
  for (const i in metaObj) {
    if (i === 'name') {
      tmp.title = metaObj[i]
    } else if (
      i === 'validation' ||
      i === 'progress' ||
      i === 'format' ||
      i === 'ui'
    ) {
      if (metaObj[i] === 'url') {
        // tmp.format = 'URL'
      }
      if (
        (metaObj[i] === 'bytes' && obj.type === 'number') ||
        metaObj.type === 'float'
      ) {
        tmp.display = 'bytes'
      }
    } else {
      tmp[i] = metaObj[i]
    }
  }
  return tmp
}

const migrateField = (oldField: any): BasedSchemaFieldPartial | null => {
  switch (oldField.type) {
    case 'object':
      return {
        ...metaParser(oldField),
        type: 'object',
        properties: migrateFields(oldField.properties, true),
      }
    case 'json':
      return {
        ...oldField,
        ...metaParser(oldField),
        type: 'json',
      }
    case 'array':
      const values = migrateField(oldField.items)
      if (!values) {
        return null
      }
      return {
        ...metaParser(oldField),
        type: 'array',
        values,
      }
    case 'set':
      return {
        ...metaParser(oldField),
        type: 'set',
        items: migrateField(oldField.items) as BasedSchemaFieldPartial,
      }
    case 'record':
      return {
        ...metaParser(oldField),
        type: 'record',
        values: migrateField(oldField.values) as BasedSchemaFieldPartial,
      }
    case 'reference':
    case 'references':
      return {
        ...metaParser(oldField),
        type: oldField.type,
        ...(oldField.bidirectional
          ? { bidirectional: oldField.bidirectional }
          : null),
      }
    case 'float':
      return {
        ...metaParser(oldField),
        type: 'number',
      }
    case 'int':
      return {
        ...metaParser(oldField),
        type: 'integer',
      }
    case 'digest':
      return {
        ...metaParser(oldField),
        format: 'strongPassword',
        type: 'string',
      }
    case 'id':
      return {
        format: 'basedId',
        ...metaParser(oldField),
        type: 'string',
      }

    case 'url':
      return {
        ...metaParser(oldField),
        format: 'URL',
        type: 'string',
      }
    case 'email':
      return {
        format: 'email',
        ...metaParser(oldField),
        type: 'string',
      }
    case 'phone':
      return {
        ...metaParser(oldField),
        format: 'mobilePhone',
        type: 'string',
      }
    case 'geo':
      return {
        ...metaParser(oldField),
        format: 'latLong',
        type: 'string',
      }
    case 'type':
      return {
        ...metaParser(oldField),
        type: 'string',
      }
    case 'number':
      return {
        ...metaParser(oldField),
        type: 'number',
      }
    default:
      return {
        ...metaParser(oldField),
        type: oldField.type,
      }
  }
}

const migrateFields = (
  oldFields: any,
  recursing = false
): { [key: string]: any } => {
  const result: { [key: string]: any } = {}
  if (oldFields) {
    for (const key in oldFields) {
      if (true) {
        if (!recursing && Object.keys(DEFAULT_FIELDS).includes(key)) {
          continue
        }
        const field = migrateField(oldFields[key])
        if (!field) {
          continue
        }

        result[key] = field
      }
    }
  }
  return result
}

const migrateTypes = (oldSchema: any): any => {
  const result = {
    types: {},
  }
  for (const key in oldSchema.types) {
    if (oldSchema.types.hasOwnProperty(key)) {
      const type = oldSchema.types[key]

      result.types[key] = {
        ...metaParser(type),
        prefix: type.prefix,
        fields: migrateFields(type.fields),
      }
    }
  }

  return result
}

const convertRoot = (oldSchema: BasedOldSchema) => {
  const result = {
    fields: {},
    ...metaParser(oldSchema.rootType?.meta),
    ...(oldSchema.rootType?.prefix
      ? { prefix: oldSchema.rootType.prefix }
      : null),
  }

  for (const i in oldSchema.rootType?.fields) {
    const field = oldSchema.rootType?.fields[i]

    result.fields[i] = {
      ...metaParser(field?.meta),
      ...migrateField(field),
    }
  }

  return result
}

export const convertOldToNew = (oldSchema: BasedOldSchema): BasedSchema => {
  const tempSchema = migrateTypes(oldSchema)

  tempSchema.$defs = {}
  tempSchema.language = oldSchema.languages[0]
  tempSchema.prefixToTypeMapping = oldSchema.prefixToTypeMapping
  tempSchema.translations = oldSchema.languages.filter((_, i) => i !== 0)

  tempSchema.root = convertRoot(oldSchema)
  delete tempSchema.rootType
  delete tempSchema.sha

  return tempSchema
}
