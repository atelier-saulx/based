import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('parse', () => {
  parse({
    types: {
      coolname: {
        props: {
          myTimestamp: {
            type: 'timestamp',
          },
        },
      },
      jurbo: {
        props: {
          flurk: {
            type: 'string',
          },
        },
      },
    },
  })

  // types |
  // [0, 'coolname', ]
})
