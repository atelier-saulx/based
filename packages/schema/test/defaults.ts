import test from 'node:test'
import { parseSchema } from '../src/schema/schema.js'
import assert from 'node:assert'

await test('defaults', () => {
  parseSchema({
    types: {
      role: {
        name: {
          type: 'string',
          default: 'John Doe',
        },
        age: {
          type: 'uint8',
          default: 21,
        },
      },
    },
  })

  assert.throws(
    () =>
      parseSchema({
        types: {
          role: {
            name: {
              type: 'string',
              default: 1,
            },
          },
        },
      }),
    {
      message:
        "types.role: { type: 'string', default: 1 } Default should be string",
    },
  )
})
