import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('enum', () => {
  parse({
    props: {
      myEnum: {
        enum: ['published', 'draft'],
        default: 'published',
      },
    },
  })

  parse({
    props: {
      myEnum: ['published', 'draft'],
    },
  })

  throws(() => {
    parse({
      props: {
        myEnum: {
          enum: ['published', 'draft'],
          default: 'blurdo',
        },
      },
    })
  }, 'disallow non defined default')
})
