import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('boolean', () => {
  parse({
    types: {
      test: {
        myBoolean: {
          type: 'boolean',
          default: true,
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        test: {
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
