import { test } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('json', async () => {
  parse({
    types: {
      article: {
        props: {
          myCoolJson: 'json',
          myCoolJson2: {
            type: 'json',
          },
        },
      },
    },
  })
})
