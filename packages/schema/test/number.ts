import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('number', () => {
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

  throws(() => {
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

  throws(() => {
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
