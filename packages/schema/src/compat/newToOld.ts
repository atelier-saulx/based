import { BasedSchema } from '../types.js'

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
      field === '$delete'
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
