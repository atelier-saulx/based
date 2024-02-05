import { BasedSchema } from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

const metaChecker = (field: string) => {
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
  )
}

const excludedFields = (field: string) => {
  return field === 'language' || field === 'translations' || field === '$defs'
}

export const convertNewToOld = (
  schema: BasedSchema
): Partial<BasedOldSchema> => {
  const tmpSchema: any = {}

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

  walker(tmpSchema, schema)
  if ((tmpSchema.meta = {})) delete tmpSchema.meta
  for (const i in tmpSchema) {
    if (excludedFields(i)) {
      delete tmpSchema[i]
    }
  }

  tmpSchema.languages = [schema.language, ...schema?.translations]

  return tmpSchema
}
