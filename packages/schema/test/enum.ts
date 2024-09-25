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

  parseSchema({
    props: {
      myEnum: ['published', 'draft'],
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
