import { test, throws } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('number', async () => {
  parse({
    types: {
      myType: {
        myNumber: {
          type: 'number',
          default: 11,
          min: 10,
          max: 100,
          step: 0.5,
        },
      },
    },
  })

  throws(async () => {
    parse({
      types: {
        myType: {
          myNumber: {
            type: 'number',
            default: 200,
            min: 10,
            max: 100,
            step: 0.5,
          },
        },
      },
    })
  }, 'should throw with out of range default')

  throws(async () => {
    parse({
      types: {
        myType: {
          myNumber: {
            type: 'number',
            default: 110,
            min: 10,
            max: 100,
            step: 0.7,
          },
        },
      },
    })
  }, 'should throw with unreachable default')
})
