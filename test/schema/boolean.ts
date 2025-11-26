import { test, throws } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('boolean', async () => {
  parse({
    types: {
      myType: {
        myBoolean: {
          type: 'boolean',
          default: true,
        },
      },
    },
  })

  throws(async () => {
    parse({
      types: {
        myType: {
          // @ts-expect-error
          myBoolean: {
            type: 'boolean',
            default: 'hello',
          },
        },
      },
    })
  }, 'only allow booleans')
})
