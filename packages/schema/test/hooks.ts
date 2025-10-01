import test from 'node:test'
import { deSerialize, parse, serialize } from '@based/schema'
import { deepEqual } from 'assert'

await test('hooks', () => {
  const { schema } = parse({
    types: {
      user: {
        stringified: {
          type: 'string',
          hooks: {
            create(value, payload) {
              return JSON.stringify({ value, payload })
            },
          },
        },
      },
    },
  })

  const serialized = serialize(schema)
  const deserialized = deSerialize(serialized)
  const value = 1
  const payload = { bla: true }
  const result = JSON.stringify({ value, payload })
  const res1 = schema.types.user.props.stringified.hooks.create(value, payload)
  const res2 = deserialized.types.user.props.stringified.hooks.create(
    value,
    payload,
  )

  deepEqual(result, res1)
  deepEqual(result, res2)
})
