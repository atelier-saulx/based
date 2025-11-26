import test from '../shared/test.js'
import { parse } from '@based/sdk'

await test('alias', async () => {
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
