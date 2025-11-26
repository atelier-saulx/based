import { test, throws } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('text', async () => {
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

  throws(async () => {
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

  throws(async () => {
    parse({
      types: {
        product: {
          description: 'text',
        },
      },
    })
  }, 'type text requires locales to be defined 2')
})
