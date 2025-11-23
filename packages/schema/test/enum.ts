import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('enum', () => {
  parse({
    types: {
      myType: {
        myEnum: {
          enum: ['published', 'draft'],
          default: 'published',
        },
      },
    },
  })

  parse({
    types: {
      myType: {
        myEnum: ['published', 'draft'],
      },
    },
  })

  throws(() => {
    parse({
      types: {
        myType: {
          myEnum: {
            enum: ['published', 'draft'],
            default: 'blurdo',
          },
        },
      },
    })
  }, 'disallow non defined default')
})
