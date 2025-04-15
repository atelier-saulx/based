import test from 'node:test'
import { parse } from '@based/schema'

await test('alias', () => {
  parse({
    types: {
      article: {
        props: {
          externalId: {
            type: 'alias',
          },
          friendlyUrl: {
            type: 'alias',
          },
          body: {
            type: 'string',
          },
        },
      },
    },
  })
})
