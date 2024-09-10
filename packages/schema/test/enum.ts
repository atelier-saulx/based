import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('enum', () => {
  parseSchema({
    props: {
      myEnum: {
        enum: ['published', 'draft'],
        defaultValue: 'published',
      },
    },
  })

  throws(() => {
    parseSchema({
      props: {
        myEnum: {
          enum: ['published', 'draft'],
          defaultValue: 'blurdo',
        },
      },
    })
  }, 'disallow non defined defaultValue')
})
