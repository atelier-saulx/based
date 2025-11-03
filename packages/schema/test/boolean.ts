import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('boolean', () => {
  parse({
    types: {
      youzi: {
        props: {
          myBoolean: {
            type: 'boolean',
            default: true,
          },
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        youzi: {
          props: {
            // @ts-expect-error
            myBoolean: {
              type: 'boolean',
              default: 'hello',
            },
          },
        },
      },
    })
  }, 'only allow booleans')
})
