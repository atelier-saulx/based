import { BasedSchema } from '../types.js'
import { oldSchema } from './oldSchemaType.js'

export const oldToNew = (oldSchema): BasedSchema => {
  const tempSchema = {} as any

  const walker = (target: any, source: oldSchema) => {
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
          walker(target[i], source[i])
        }
      } else if (i !== 'meta') {
        target[i] = source[i]
      }
    }
  }

  walker(tempSchema, oldSchema)
  tempSchema.$defs = {}

  return tempSchema
}
