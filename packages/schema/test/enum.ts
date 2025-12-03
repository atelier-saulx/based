import test from 'node:test'
import { equal, throws } from 'node:assert'
import { parse } from '@based/schema'

await test('enum', () => {
  const { schema } = parse({
    props: {
      myEnum: {
        enum: ['published', 'draft'],
        default: 'published',
      },
    },
  })

  equal((schema.props.myEnum as any).default, 'published')

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
