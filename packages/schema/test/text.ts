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
        fallback: ['en'],
      },
    },
    props: {
      myText: {
        type: 'text',
      },
    },
  })

  await throws(() => {
    parse({
      props: {
        myText: {
          type: 'text',
        },
      },
    })
  }, 'type text requires locales to be defined')
})
