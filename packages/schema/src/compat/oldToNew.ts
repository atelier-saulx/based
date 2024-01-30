import { BasedSchema } from '../types.js'

export const oldToNew = (oldSchema) => {
  const tempSchema = {} as BasedSchema
  const walker = (target: any, source: any) => {
    for (const i in source) {
      if (i in target) {
        if (i === 'meta') {
          for (const j in source[i]) {
            target[j] = source[i][j]
          }
          delete target[i]
        } else if (source[i] && typeof source[i] === 'object') {
          walker(target[i], source[i])
        } else {
          if (i === 'meta') {
          }
          target[i] = source[i]
        }
      } else {
        target[i] = source[i].length ? [] : {}
        walker(target, source)
      }
    }
  }

  walker(tempSchema, oldSchema)
  return tempSchema
}
