import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('parse', () => {
  parseSchema({
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
