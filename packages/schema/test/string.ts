import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('string', () => {
  parse({
    props: {
      myString: {
        type: 'string',
      },
    },
  })

  await throws(() => {
    parse({
      props: {
        // @ts-expect-error
        myEnum: {
          enum: [{ invalidObj: true }],
        },
      },
    })
  }, 'should throw with non primitive enum')
})
