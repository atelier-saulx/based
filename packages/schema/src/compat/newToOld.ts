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
  const tempSchema = {} as oldSchema
  tempSchema.languages = [schema.language, ...schema.translations]

  const walker = (target) => {
    for (const i in target) {
      console.log(i)
    }
  }

  walker(schema.types)
  //   console.dir(tempSchema, { depth: null })
  //   console.log(JSON.stringify(tempSchema, null, 4))
}
