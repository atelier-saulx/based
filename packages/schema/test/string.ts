import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('string', () => {
  parseSchema({
    props: {
      myString: {
        type: 'string',
      },
    },
  })

  throws(() => {
    parseSchema({
      props: {
        // @ts-ignore
        myEnum: {
          enum: [{ invalidObj: true }],
        },
      },
    })
  }, 'should throw with non primitive enum')
})
