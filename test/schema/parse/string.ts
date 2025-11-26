import { test, throws } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('string', async () => {
  parse({
    types: {
      myType: {
        myString: {
          type: 'string',
        },
      },
    },
  })

  throws(async () => {
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
