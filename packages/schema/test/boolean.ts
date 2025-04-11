import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('boolean', () => {
  parse({
    props: {
      myBoolean: {
        type: 'boolean',
        default: true,
      },
    },
  })

  await throws(() => {
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
