import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaFieldPartial,
} from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

const DEFAULT_FIELDS: any = {
  id: { type: 'string' },
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' },
  type: { type: 'string' },
  parents: { type: 'references' },
  children: { type: 'references' },
  ancestors: { type: 'references' },
  descendants: { type: 'references' },
  aliases: {
    type: 'set',
    items: { type: 'string' },
  },
}

const metaParser = (metaObj) => {
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
        tmp.format = 'URL'
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
        ...metaParser(oldField.meta),
        type: 'object',
        properties: migrateFields(oldField.properties, true),
      }
    case 'json':
      return {
        ...oldField,
        ...metaParser(oldField.meta),
        type: 'json',
      }
    case 'array':
      const values = migrateField(oldField.items)
      if (!values) {
        return null
      }
      return {
        ...metaParser(oldField.meta),
        type: 'array',
        values,
      }
    case 'set':
      return {
        ...metaParser(oldField.meta),
        type: 'set',
        items: migrateField(oldField.items) as BasedSchemaFieldPartial,
      }
    case 'record':
      return {
        ...metaParser(oldField.meta),
        type: 'record',
        values: migrateField(oldField.values) as BasedSchemaFieldPartial,
      }
    case 'reference':
    case 'references':
      return {
        ...metaParser(oldField.meta),
        type: oldField.type,
        ...(oldField.bidirectional
          ? { bidirectional: oldField.bidirectional }
          : null),
      }
    case 'float':
      return {
        ...metaParser(oldField.meta),
        type: 'number',
      }
    case 'int':
      return {
        ...metaParser(oldField.meta),
        type: 'integer',
      }
    case 'digest':
      return {
        format: 'strongPassword',
        type: 'string',
      }
    case 'id':
      return {
        ...metaParser(oldField.meta),
        type: 'string',
      }

    case 'url':
      return {
        ...metaParser(oldField.meta),
        format: 'URL',
        type: 'string',
      }
    case 'email':
      return {
        ...metaParser(oldField.meta),
        type: 'string',
      }
    case 'phone':
      return {
        format: 'mobilePhone',
        type: 'string',
      }
    case 'geo':
      return {
        format: 'latLong',
        type: 'string',
      }
    case 'type':
      return {
        ...metaParser(oldField.meta),
        type: 'string',
      }
    default:
      return {
        ...metaParser(oldField.meta),
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
      if (oldFields.hasOwnProperty(key)) {
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
        prefix: type.prefix,
        fields: migrateFields(type.fields),
      }
    }
  }

  return result
}

export const convertOldToNew = (oldSchema: BasedOldSchema): BasedSchema => {
  const tempSchema = migrateTypes(oldSchema)

  tempSchema.$defs = {}
  tempSchema.root = tempSchema.rootType ?? {}
  delete tempSchema.rootType
  delete tempSchema.sha

  return tempSchema
}
