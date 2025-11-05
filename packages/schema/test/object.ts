import test from 'node:test'
import { parse } from '@based/schema'

await test('object', () => {
  parse({
    types: {
      test: {
        myObject: {
          props: {
            myField: {
              type: 'boolean',
            },
          },
        },
      },
    },
  })
})
