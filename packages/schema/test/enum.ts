import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('enum', () => {
  parse({
    types: {
      youzi: {
        props: {
          myEnum: {
            enum: ['published', 'draft'],
            default: 'published',
          },
        },
      },
    },
  })

  parse({
    types: {
      youzi: {
        props: {
          myEnum: ['published', 'draft'],
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        youzi: {
          props: {
            myEnum: {
              enum: ['published', 'draft'],
              default: 'blurdo',
            },
          },
        },
      },
    })
  }, 'disallow non defined default')

  throws(() => {
    parse({
      types: {
        youzi: {
          props: {
            // @ts-expect-error
            myEnum: {
              enum: [{ invalidObj: true }],
            },
          },
        },
      },
    })
  }, 'should throw with non primitive enum')
})
