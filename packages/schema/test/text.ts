import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('text', () => {
  parse({
    locales: {
      en: {
        required: true,
      },
      de: {},
      nl: {
        fallback: 'en',
      },
    },
    types: {
      myType: {
        myText: {
          type: 'text',
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        myType: {
          myText: {
            type: 'text',
          },
        },
      },
    })
  }, 'type text requires locales to be defined')

  throws(() => {
    parse({
      types: {
        product: {
          description: 'text',
        },
      },
    })
  }, 'type text requires locales to be defined 2')
})
