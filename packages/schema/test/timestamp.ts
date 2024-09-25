import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('timestamp', () => {
  parseSchema({
    props: {
      myTimestamp: {
        type: 'timestamp',
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
