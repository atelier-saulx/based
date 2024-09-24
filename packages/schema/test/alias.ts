import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('boolean', () => {
  parseSchema({
    props: {
      myBoolean: {
        type: 'boolean',
        default: true,
      },
    },
  })

  throws(() => {
    parseSchema({
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
