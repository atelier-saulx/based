import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('enum', () => {
  parse({
    props: {
      myEnum: {
        enum: ['published', 'draft'],
        defaultValue: 'published',
      },
    },
  })

  throws(() => {
    parse({
      props: {
        myEnum: {
          enum: ['published', 'draft'],
          defaultValue: 'blurdo',
        },
      },
    })
  }, 'disallow non defined defaultValue')
})
