import test from 'node:test'
import { parse } from '@based/schema'

await test('json', () => {
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
