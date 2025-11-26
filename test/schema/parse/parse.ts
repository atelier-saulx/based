import { test } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('parse', async () => {
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
