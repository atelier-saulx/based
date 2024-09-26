import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('text', () => {
  parse({
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
    parse({
      props: {
        myText: {
          type: 'text',
        },
      },
    })
  }, 'type text requires locales to be defined')
})
