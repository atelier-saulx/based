import test from 'node:test'
import { parse } from '@based/schema'

test('alias', () => {
  parse({
    types: {
      article: {
        props: {
          friendlyUrl: {
            type: 'alias',
          },
          externalId: 'alias',
        },
      },
    },
  })
})
