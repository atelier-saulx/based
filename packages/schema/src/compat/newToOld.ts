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
  const tempSchema = {} as BasedSchema
  const checker = (field) => {
    return field === 'description' || field === 'title' || field === 'examples'
  }

  const walker = (target: any, source: any) => {
    for (const i in source) {
      if (i in target) {
        if (source[i] && typeof source[i] === 'object') {
          walker(target[i], source[i])
        } else {
          if (!checker(i)) {
            target[i] = source[i]
          } else {
            target.meta = {}
            // console.log(i)
            for (const i in source) {
              if (checker(i)) {
                target.meta = { ...target.meta, [i]: source[i] }
                delete source[i]
              }
            }

            // target.meta[i] = source[i]
          }
        }
      } else {
        target[i] = source[i].length ? [] : {}
        walker(target, source)
      }
    }
  }

  walker(tempSchema, schema)
  return tempSchema
}
