import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('text', () => {
  parseSchema({
    types: {
      hello: {
        props: {
          myText: 'text',
          myString: 'string',
          myNumber: 'number',
        },
      },
    },
    props: {
      myText: 'text',
    },
  })

  throws(() => {
    parseSchema({
      props: {
        myText: {
          type: 'text',
        },
      },
    })
  }, 'type text requires locales to be defined')
})
