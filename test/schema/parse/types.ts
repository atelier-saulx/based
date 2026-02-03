import {
  parseSchema,
  type SchemaOut,
  type SchemaReferences,
} from '../../../src/schema.js'
import { test } from '../../shared/index.js'

await test('types', async () => {
  const schemaOut: SchemaOut = parseSchema({
    hash: 0,
    locales: {
      nl: true,
    },
    types: {
      coolUser: {
        props: {
          name: 'string',
          myObj: {
            type: 'object',
            props: {
              dicky: 'string',
            },
          },
        },
      },
      coolType: {
        myUser: {
          ref: 'coolUser',
          prop: 'myType',
        },
      },
    },
  })
})
