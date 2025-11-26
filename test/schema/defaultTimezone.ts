import test from 'node:test'
import { parse } from '@based/schema'
import assert, { throws } from 'assert'

await test('defaultTimezone', () => {
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

  throws(() => parse({
    defaultTimezone: 'Europe/Turku',
    types: {
      user: {
        props: {
          timestamp: { type: 'timestamp' },
        },
      },
    },
  }))

  throws(() => parse({
    // @ts-ignore
    defaultTimezone: 2,
    types: {
      user: {
        props: {
          timestamp: { type: 'timestamp' },
        },
      },
    },
  }))
})
