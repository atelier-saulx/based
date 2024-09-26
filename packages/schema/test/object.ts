import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('object', () => {
  parse({
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
