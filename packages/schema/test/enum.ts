import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('enum', () => {
  parseSchema({
    props: {
      myEnum: {
        enum: ['published', 'draft'],
        default: 'published',
      },
    },
  })

  throws(() => {
    parseSchema({
      props: {
        myEnum: {
          enum: ['published', 'draft'],
          default: 'blurdo',
        },
      },
    })
  }, 'disallow non defined default')
})
