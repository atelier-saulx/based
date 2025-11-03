import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('string', () => {
  parse({
    types: {
      youzi: {
        props: {
          myString: {
            type: 'string',
          },
        },
      },
    },
  })
})
