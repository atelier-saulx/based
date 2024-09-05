import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('boolean', () => {
  parse({
    props: {
      myBoolean: {
        type: 'boolean',
        defaultValue: true,
      },
    },
  })

  throws(() => {
    parse({
      props: {
        // @ts-ignore
        myBoolean: {
          type: 'boolean',
          defaultValue: 'hello',
        },
      },
    })
  }, 'only allow booleans')
})
