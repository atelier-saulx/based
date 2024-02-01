import { languages } from '../languages.js'
import { oldSchema } from './oldSchemaType.js'

export const oldToNew = (oldSchema): oldSchema => {
  const tempSchema = {} as any

  const walker = (target: any, source: oldSchema) => {
    for (const i in source) {
      if (i === 'languages') {
        target.language = source[i][0]
        target.translations = source[i].filter((_, i) => i === 1)
      } else if (typeof source[i] === 'object' && i in target === false) {
        if (i !== 'meta') {
          target[i] = source[i].length ? [] : {}
          walker(target[i], source[i])
        } else {
          for (const j in source[i]) {
            console.log(j)
            if (j === 'name') {
              target.title = source[i][j]
            } else {
              target[j] = source[i][j]
            }
          }
        }
      } else if (i !== 'meta') {
        target[i] = source[i]
      }
    }
  }

  walker(tempSchema, oldSchema)
  return tempSchema
}
