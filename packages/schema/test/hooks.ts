import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('hooks', () => {
  parse({
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
