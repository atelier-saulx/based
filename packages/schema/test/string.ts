import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('string', () => {
  parse({
    types: {
      test: {
        myString: {
          type: 'string',
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        test: {
          // @ts-expect-error
          myEnum: {
            enum: [{ invalidObj: true }],
          },
        },
      },
    })
  }, 'should throw with non primitive enum')
})
