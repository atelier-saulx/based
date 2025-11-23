import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('string', () => {
  parse({
    types: {
      myType: {
        myString: {
          type: 'string',
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        myType: {
          // @ts-expect-error
          myEnum: {
            enum: [{ invalidObj: true }],
          },
        },
      },
    })
  }, 'should throw with non primitive enum')
})
