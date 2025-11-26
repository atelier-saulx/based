import { test, throws } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('enum', async () => {
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

  throws(async () => {
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
