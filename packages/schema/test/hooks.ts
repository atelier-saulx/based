import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('hooks', () => {
  parseSchema({
    types: {
      article: {
        hooks: {
          create: 'search-add',
          update: 'search-add',
          delete: 'search-del',
        },
        props: {
          body: {
            type: 'string',
          },
        },
      },
    },
  })
})
