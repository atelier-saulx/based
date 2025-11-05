import test from 'node:test'
import { parse } from '@based/schema'

await test('string', () => {
  parse({
    types: {
      test: {
        myString: {
          type: 'string',
        },
      },
    },
  })
})
