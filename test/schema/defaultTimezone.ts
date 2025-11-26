import assert from 'assert'
import { test, throws } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('defaultTimezone', async () => {
  let parsed = parse({
    types: {
      user: {
        props: {
          timestamp: { type: 'timestamp' },
        },
      },
    },
  })

  assert(parsed.schema.defaultTimezone === undefined)

  parsed = parse({
    defaultTimezone: 'Europe/Helsinki',
    types: {
      user: {
        props: {
          timestamp: { type: 'timestamp' },
        },
      },
    },
  })

  assert(parsed.schema.defaultTimezone === 'Europe/Helsinki')

  throws(async () =>
    parse({
      defaultTimezone: 'Europe/Turku',
      types: {
        user: {
          props: {
            timestamp: { type: 'timestamp' },
          },
        },
      },
    }),
  )

  throws(async () =>
    parse({
      // @ts-ignore
      defaultTimezone: 2,
      types: {
        user: {
          props: {
            timestamp: { type: 'timestamp' },
          },
        },
      },
    }),
  )
})
