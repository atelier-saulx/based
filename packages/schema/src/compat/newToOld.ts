// import { BasedSchema } from '../types.js'
// import { BasedOldSchema } from './oldSchemaType.js'

// const metaChecker = (field: string) => {
//   return (
//     field === 'validation' ||
//     field === 'format' ||
//     field === 'index' ||
//     field === 'description' ||
//     field === 'title' ||
//     field === 'examples' ||
//     field === 'ui' ||
//     field === 'isRequired' ||
//     field === 'title' ||
//     field === 'description' ||
//     field === 'index' ||
//     field === 'readOnly' ||
//     field === 'writeOnly' ||
//     field === '$comment' ||
//     field === 'examples' ||
//     field === 'default' ||
//     field === 'customValidator' ||
//     field === 'value' ||
//     field === 'path' ||
//     field === 'target' ||
//     field === 'minLength' ||
//     field === 'maxLength' ||
//     field === 'contentMediaEncoding' ||
//     field === 'pattern' ||
//     field === 'display' ||
//     field === 'multiline' ||
//     field === 'multipleOf' ||
//     field === 'minimum' ||
//     field === 'maximum' ||
//     field === 'exclusiveMaximum' ||
//     field === 'exclusiveMinimum' ||
//     field === '$delete'
//   )
// }

// const excludedFields = (field: string) => {
//   return field === 'language' || field === 'translations' || field === '$defs'
// }

// export const convertNewToOld = (
//   schema: BasedSchema
// ): Partial<BasedOldSchema> => {
//   const tmpSchema: any = {}

//   const walker = (target: any, source: any) => {
//     for (const i in source) {
//       if (source[i] && typeof source[i] === 'object' && i in target === false) {
//         target[i] = source[i].length ? [] : {}
//         walker(target[i], source[i])
//       } else if (!metaChecker(i)) {
//         if (i === 'integer') {
//           target.int = source[i]
//         }
//         target[i] = source[i]
//       } else {
//         target.meta = {}
//         for (const i in source) {
//           if (metaChecker(i) && typeof source[i] !== 'object') {
//             if (i === 'title') {
//               target.meta = { ...target.meta, name: source[i] }
//             } else {
//               target.meta = { ...target.meta, [i]: source[i] }
//             }
//             delete source[i]
//           }
//         }
//       }
//     }
//   }

//   walker(tmpSchema, schema)

//   if ((tmpSchema.meta = {})) delete tmpSchema.meta
//   for (const i in tmpSchema) {
//     if (excludedFields(i)) {
//       delete tmpSchema[i]
//     }
//   }

//   tmpSchema.languages = [schema.language, ...schema?.translations]
//   // tmpSchema.rootType = tmpSchema.root ?? {}
//   delete tmpSchema.root

//   return tmpSchema
// }
import { BasedSchema } from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

const metaChecker = (field: string) => {
  return (
    field === 'validation' ||
    // field === 'format' ||
    field === 'index' ||
    field === 'description' ||
    field === 'title' ||
    field === 'examples' ||
    field === 'ui' ||
    field === 'isRequired' ||
    field === 'title' ||
    field === 'description' ||
    field === 'index' ||
    field === 'readOnly' ||
    field === 'writeOnly' ||
    field === '$comment' ||
    field === 'examples' ||
    field === 'default' ||
    field === 'customValidator' ||
    field === 'value' ||
    field === 'path' ||
    field === 'target' ||
    field === 'minLength' ||
    field === 'maxLength' ||
    field === 'contentMediaEncoding' ||
    field === 'pattern' ||
    field === 'display' ||
    field === 'multiline' ||
    field === 'multipleOf' ||
    field === 'minimum' ||
    field === 'maximum' ||
    field === 'exclusiveMaximum' ||
    field === 'exclusiveMinimum' ||
    field === '$delete' ||
    field === 'display'
  )
}

const excludedFields = (field: string) => {
  return field === 'language' || field === 'translations' || field === '$defs'
}

import {
  BasedSchemaField,
  BasedSchemaFieldPartial,
  BasedSchemaPartial,
} from '../types.js'

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
  const tmp = {} as BasedSchemaFieldPartial | any
  for (const i in obj) {
    if (metaChecker(i)) {
      if (i === 'title') {
        tmp.name = obj[i]
      } else if (obj[i] === 'bytes') {
        tmp.format = obj[i]
      } else {
        tmp[i] = obj[i]
      }
    }
  }

  return Object.keys({ meta: tmp }.meta).length > 0 ? { meta: tmp } : null
}

const migrateField = (field: any): any | null => {
  if (field?.type === 'object') {
    return {
      ...metaParser(field),
      type: 'object',
      properties: migrateFields(field.properties, true),
    }
  } else if (field?.type === 'json') {
    return {
      ...field,
      ...metaParser(field),
      type: 'json',
    }
  } else if (field?.type === 'array') {
    const values = migrateField(field.values)
    if (!values) {
      return null
    }
    return {
      ...metaParser(field),
      type: 'array',
      items: values,
    }
  } else if (field?.type === 'set') {
    return {
      ...metaParser(field),
      type: 'set',
      items: migrateField(field.items) as BasedSchemaFieldPartial,
    }
  } else if (field?.type === 'record') {
    return {
      ...metaParser(field),
      type: 'record',
      values: migrateField(field.values) as BasedSchemaFieldPartial,
    }
  } else if (field?.type === 'reference' || field?.type === 'references') {
    return {
      ...metaParser(field),
      type: field?.type,
      ...(field.bidirectional ? { bidirectional: field.bidirectional } : null),
    }
  } else if (field?.type === 'integer') {
    return {
      ...metaParser(field),
      type: 'int',
    }
  } else if (field?.format === 'strongPassword') {
    return { ...metaParser(field), type: 'digest' }
  } else if (field?.format === 'basedId') {
    return { ...metaParser(field), type: 'id' }
  } else if (field?.format === 'URL') {
    return { ...metaParser(field), type: 'url' }
  } else if (field?.format === 'email') {
    return {
      ...metaParser(field),
      type: 'email',
    }
  } else if (field?.format === 'mobilePhone') {
    return {
      ...metaParser(field),
      type: 'phone',
    }
  } else if (field?.format === 'latLong') {
    return {
      ...metaParser(field),
      type: 'geo',
    }
  } else {
    return { ...metaParser(field), type: field?.type }
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
        ...metaParser(type),
        prefix: type.prefix,
        fields: migrateFields(type.fields),
      }
    }
  }

  return result
}

const convertRoot = (schema: BasedSchemaPartial) => {
  const result = {
    fields: {},
    ...metaParser(schema.root),
    ...(schema.root?.prefix ? { prefix: schema.root.prefix } : null),
  }

  for (const i in schema.root?.fields) {
    const field = schema.root?.fields[i]
    result.fields[i] = {
      ...metaParser(field),
      ...migrateField(field),
    }
  }

  return result
}

export const convertNewToOld = (
  schema: BasedSchema
): Partial<BasedOldSchema> => {
  const tmpSchema = migrateTypes(schema)
  tmpSchema.prefixToTypeMapping = schema.prefixToTypeMapping
  tmpSchema.languages = [schema.language, ...schema?.translations]

  tmpSchema.rootType = convertRoot(schema)

  delete tmpSchema.root

  return tmpSchema
}
