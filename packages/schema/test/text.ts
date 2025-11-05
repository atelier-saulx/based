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
      test: {
        props: {
          myText: {
            type: 'text',
          },
        },
      },
    },
  })

  throws(() => {
    parse({
      locales: {
        en: {
          // @ts-expect-error
          required: 1,
        },
      },
    })
  }, 'invalid locales')

  throws(() => {
    parse({
      types: {
        test: {
          props: {
            myText: {
              type: 'text',
            },
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

  throws(() => {
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
        product: {
          description: {
            type: 'text',
            // @ts-expect-error
            non: true,
          },
        },
      },
    })
  }, 'type text wrong property')
})
