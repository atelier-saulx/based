import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('number', () => {
  parseSchema({
    props: {
      myNumber: {
        type: 'number',
        defaultValue: 11,
        min: 10,
        max: 100,
        step: 0.5,
      },
    },
  })

  throws(() => {
    parseSchema({
      props: {
        myNumber: {
          type: 'number',
          defaultValue: 200,
          min: 10,
          max: 100,
          step: 0.5,
        },
      },
    })
  }, 'should throw with out of range defaultValue')

  throws(() => {
    parseSchema({
      props: {
        myNumber: {
          type: 'number',
          defaultValue: 11,
          min: 10,
          max: 100,
          step: 0.7,
        },
      },
    })
  }, 'should throw with unreachable defaultValue')
})
