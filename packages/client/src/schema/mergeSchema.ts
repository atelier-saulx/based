import { BasedSchema, BasedSchemaType } from '@based/schema'
import { deepCopy, deepMerge } from '@saulx/utils'
import { SchemaMutations } from '../types'
import { generateNewPrefix } from './utils'
import { getSchemaTypeFieldByPath } from '../util'

export const DEFAULT_FIELDS: any = {
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

// not needed?
// const addDefaultFieldsToNestedProperties = (fields: any) => {
//   for (const fieldName in fields) {
//     fields[fieldName] = {
//       ...DEFAULT_FIELDS,
//       ...fields[fieldName],
//     }
//     if (fields[fieldName].properties) {
//       addDefaultFieldsToNestedProperties(fields[fieldName].properties)
//     }
//   }
// }

export const mergeSchema = (
  currentSchema: BasedSchema,
  mutations: SchemaMutations
) => {
  const newSchema = deepCopy(currentSchema)
  // TODO: check changes to root

  // TODO: try to add DEFAULT_SCHEMA initialization here

  // TODO: change mutation.mutation to enum

  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      delete newSchema.types[mutation.type]
    } else if (mutation.mutation === 'remove_field') {
      // TODO: test root support
      if (mutation.type === 'root') {
        throw new Error('>>>> implement!')
      } else if (mutation.path.length > 1) {
        delete getSchemaTypeFieldByPath(
          newSchema.types[mutation.type],
          mutation.path.slice(0, -1)
        )[mutation.type]
      } else {
        delete newSchema.types[mutation.type].fields[
          mutation.path[mutation.path.length - 1]
        ]
      }
    } else if (mutation.mutation === 'new_type') {
      const prefix = generateNewPrefix(mutation.type, currentSchema)
      newSchema.types[mutation.type] = deepMerge(
        {
          prefix,
          fields: deepCopy(DEFAULT_FIELDS),
        },
        mutation.new
      )
      newSchema.prefixToTypeMapping[prefix] = mutation.type
    } else if (mutation.mutation === 'change_type') {
      deepMerge(newSchema.types[mutation.type], mutation.new)
    } else if (mutation.mutation === 'new_field') {
      // newSchema.types[mutation.type] = deepMerge(
      //   {
      //     prefix,
      //     fields: deepCopy(DEFAULT_FIELDS),
      //   },
      //   mutation.new
      // )
      console.log('=======', mutation)
      // getSchemaTypeFieldByPath(newSchema.types[mutation.type], mutation.path)
    } else if (mutation.mutation === 'change_field') {
      const field = getSchemaTypeFieldByPath(
        newSchema.types[mutation.type],
        mutation.path
      )
      // TODO: test prefix change
      deepMerge(field, mutation.new)
    } else {
      throw new Error('Unknow mutation type')
    }
  }

  return newSchema
}
