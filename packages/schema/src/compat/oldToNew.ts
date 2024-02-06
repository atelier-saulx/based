import { BasedSchema } from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

const oldConverter = (field) => {
  return field === 'id'
    ? 'string'
    : field === 'type'
    ? 'string'
    : field === 'url'
    ? 'string'
    : field === 'email'
    ? 'string'
    : field === 'digest'
    ? 'string'
    : field === 'int'
    ? 'integer'
    : field === 'float'
    ? 'number'
    : field
}

const converter = (source, target, i) => {
  switch (source.type) {
    case 'url':
      return { ...target, type: 'string', format: 'URL' }
    case 'id':
      return { ...target, type: 'string', format: 'basedId' }
    case 'type':
      return { ...target, type: 'string' }
    case 'email':
      return { ...target, type: 'string', format: 'email' }
    case 'digest':
      return { ...target, type: 'string', format: 'strongPassword' }
    case 'int':
      return { ...target, type: 'integer' }
    case 'float':
      return { ...target, type: 'number' }
    case 'array':
      return { ...target, type: 'array', values: source.items }
    default:
      return { ...source }
  }
}

export const convertOldToNew = (oldSchema: BasedOldSchema): BasedSchema => {
  const tempSchema = {} as any

  const walker = (source: BasedOldSchema, target: any) => {
    for (const i in source) {
      if (i === 'languages' && source[i].length) {
        target.language = source[i][0]
        target.translations = source[i].filter((_, i) => i !== 0)
      } else if (typeof source[i] === 'object' && i in target === false) {
        if (
          i === 'meta' &&
          !Object.keys(source[i]).includes('properties' || 'type')
        ) {
          for (const j in source[i]) {
            if (j === 'name') {
              target.title = source[i][j]
            } else if (j === 'validation') {
              target.format = source[i][j] === 'url' ? 'URL' : null
            } else {
              target[j] = source[i][j]
            }
          }
        } else {
          target[i] = source[i].length ? [] : {}
          walker(source[i], target[i])
        }
      } else if (i !== 'meta') {
        target[i] = converter(source, target, i)
      }
    }
  }

  // const fixer = (source) => {
  //   for (const i in source) {
  //     if (source[i] === 'array') {
  //       source.values = source.items
  //       delete source.items
  //     } else if (typeof source[i] === 'object') {
  //       fixer(source[i])
  //     }
  //   }
  // }

  walker(oldSchema, tempSchema)
  // fixer(tempSchema)

  delete tempSchema.sha
  tempSchema.$defs = {}
  tempSchema.root = tempSchema.rootType ?? {}
  delete tempSchema.rootType

  return tempSchema
}
