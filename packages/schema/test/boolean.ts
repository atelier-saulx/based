import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('boolean', () => {
  parse({
    props: {
      myBoolean: {
        type: 'boolean',
        default: true,
      },
    },
  })

  throws(() => {
    parse({
      props: {
        myBoolean: {
          type: 'boolean',
          // @ts-ignore
          default: 'hello',
        },
      },
    })
  }, 'only allow booleans')
})
