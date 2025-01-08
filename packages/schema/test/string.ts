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
          // @ts-ignore
          enum: [{ invalidObj: true }],
        },
      },
    })
  }, 'should throw with non primitive enum')

  // HANDLE THIS
  // console.log(
  //   parse({
  //     props: {
  //       myString: {
  //         type: 'string',
  //         compression: 'none',
  //       },
  //     },
  //   }),
  // )
})
