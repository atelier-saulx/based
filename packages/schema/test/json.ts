import test from 'node:test'
import { parse } from '@based/schema'

test('json', () => {
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
