import test from 'node:test'
import { parse } from '@based/schema'

await test('object', () => {
  parse({
    types: {
      myType: {
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
