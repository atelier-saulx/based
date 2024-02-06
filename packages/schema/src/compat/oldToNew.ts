import { BasedSchema } from '../types.js'
import { BasedOldSchema } from './oldSchemaType.js'

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
            } else {
              target[j] = source[i][j]
            }
          }
        } else {
          target[i] = source[i].length ? [] : {}
          walker(source[i], target[i])
        }
      } else if (i !== 'meta') {
        if (source[i] === 'int') {
          target[i] = 'integer'
        }
        target[i] = source[i]
      }
    }
  }

  walker(oldSchema, tempSchema)
  delete tempSchema.sha
  tempSchema.$defs = {}
  tempSchema.root = oldSchema.rootType ?? {}
  delete tempSchema.rootType

  return tempSchema
}
