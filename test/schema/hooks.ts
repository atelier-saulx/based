import { deepEqual, test } from '../shared/index.js'
import { deSerialize, parse, serialize } from '@based/sdk'

await test('hooks', async () => {
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
  const deserialized = deSerialize(serialized) as any
  const value = 1
  const payload = { bla: true }
  const result = JSON.stringify({ value, payload })
  // @ts-expect-error TODO this should work
  const res1 = schema.types.user.props.stringified.hooks.create(value, payload)
  const res2 = deserialized.types.user.props.stringified.hooks.create(
    value,
    payload,
  )

  deepEqual(result, res1)
  deepEqual(result, res2)
})
