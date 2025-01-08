import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('string', () => {
  parse({
    props: {
      myString: {
        type: 'string',
      },
    },
  })

  throws(() => {
    parse({
      props: {
        myEnum: {
          enum: [{ invalidObj: true }],
        },
      },
    })
  }, 'should throw with non primitive enum')
})
