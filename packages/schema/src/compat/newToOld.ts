import { BasedSchema } from '../types.js'
import { oldSchema } from './oldSchemaType.js'

const oldSchemaThingy: oldSchema = {
  languages: ['en'],

  rootType: {},
  types: {
    type1: {
      fields: {
        number: {
          type: 'reference',
        },
      },
      prefix: 'as',
      meta: {
        title: 'thingy',
      },
    },
  },
}

export const newToOld = (schema: BasedSchema) => {
  const tempSchema = {} as any
  const metaChecker = (field) => {
    return (
      field === 'validation' ||
      field === 'format' ||
      field === 'index' ||
      field === 'description' ||
      field === 'title' ||
      field === 'examples' ||
      field === 'ui'
      // field === 'name'
    )
  }
  const excludedFields = (field) => {
    return field === 'language' || field === 'translations' || field === '$defs'
  }

  const walker = (target: any, source: any) => {
    for (const i in source) {
      if (source[i] && typeof source[i] === 'object' && i in target === false) {
        target[i] = source[i].length ? [] : {}
        walker(target[i], source[i])
      } else if (!metaChecker(i)) {
        target[i] = source[i]
      } else {
        target.meta = {}
        for (const i in source) {
          if (metaChecker(i) && typeof source[i] !== 'object') {
            if (i === 'title') {
              target.meta = { ...target.meta, name: source[i] }
            } else {
              target.meta = { ...target.meta, [i]: source[i] }
            }
            delete source[i]
          }
        }
      }
    }
  }

  walker(tempSchema, schema)
  if ((tempSchema.meta = {})) delete tempSchema.meta
  for (const i in tempSchema) {
    if (excludedFields(i)) {
      delete tempSchema[i]
    }
  }

  tempSchema.languages = [schema.language, ...schema?.translations]

  return tempSchema
}
// enum to integer options in meta
