import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('object', () => {
  parseSchema({
    props: {
      myObject: {
        props: {
          myField: {
            type: 'boolean',
          },
        },
      },
    },
  })
})
