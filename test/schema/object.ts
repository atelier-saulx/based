import { test } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('object', async () => {
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
