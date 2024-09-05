import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('timestamp', () => {
  parse({
    props: {
      myTimestamp: {
        type: 'timestamp',
      },
    },
  })

  throws(() => {
    parse({
      props: {
        myEnum: {
          // @ts-ignore
          enum: [{ invalidObj: true }],
        },
      },
    })
  }, 'should throw with non primitive enum')
})
