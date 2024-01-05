import { BasedSchema, BasedSchemaField } from '@based/schema'
import { deepCopy, deepMerge } from '@saulx/utils'
import { SchemaMutation } from '../types.js'
import { getSchemaTypeFieldByPath } from '../util/index.js'
import { generateNewPrefix } from './utils.js'

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

export const mergeSchema = (
  currentSchema: BasedSchema,
  mutations: SchemaMutation[]
) => {
  const newSchema = deepCopy(currentSchema)
  // TODO: try to add DEFAULT_SCHEMA initialization here
  // TODO: change mutation.mutation to enum

  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      delete newSchema.types[mutation.type]
    } else if (mutation.mutation === 'remove_field') {
      if (mutation.path.length > 1) {
        delete getSchemaTypeFieldByPath(
          mutation.type === 'root'
            ? newSchema.root
            : newSchema.types[mutation.type],
          mutation.path.slice(0, -1)
        ).properties[mutation.path[mutation.path.length - 1]]
      } else {
        if (mutation.type === 'root') {
          delete newSchema.root.fields[mutation.path[mutation.path.length - 1]]
        } else {
          delete newSchema.types[mutation.type].fields[
            mutation.path[mutation.path.length - 1]
          ]
        }
      }
    } else if (mutation.mutation === 'new_type') {
      const prefix =
        mutation.new.prefix || generateNewPrefix(mutation.type, currentSchema)
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
      if (mutation.path.length > 1) {
        getSchemaTypeFieldByPath(
          mutation.type === 'root'
            ? newSchema.root
            : newSchema.types[mutation.type],
          mutation.path.slice(0, -1)
        ).properties[mutation.path[mutation.path.length - 1]] = mutation.new
      } else {
        if (mutation.type === 'root') {
          newSchema.root.fields[mutation.path[0]] =
            mutation.new as BasedSchemaField
        } else {
          newSchema.types[mutation.type].fields[mutation.path[0]] =
            mutation.new as BasedSchemaField
        }
      }
    } else if (mutation.mutation === 'change_field') {
      const field = getSchemaTypeFieldByPath(
        mutation.type === 'root'
          ? newSchema.root
          : newSchema.types[mutation.type],
        mutation.path
      )
      // TODO: test prefix change
      deepMerge(field, mutation.new)
    } else if (mutation.mutation === 'change_languages') {
      if (mutation.new.language) {
        newSchema.language = mutation.new.language
      }
      if (mutation.new.translations) {
        newSchema.translations = mutation.new.translations
      }
      if (mutation.new.languageFallbacks) {
        newSchema.languageFallbacks = mutation.new.languageFallbacks
      }
    } else {
      throw new Error('Unknow mutation type')
    }
  }

  return newSchema
}
