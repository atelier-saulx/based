import test from 'node:test'
import { equal } from 'node:assert'
import { parse } from '@based/schema'
import { validate } from '../src/index.js'

await test('validate', () => {
  const s = {
    types: {
      user: {
        name: 'string',
        email: { type: 'string', format: 'email' },
        age: {
          type: 'uint8',
          min: 18,
          max: 120,
        },
        address: {
          props: {
            street: {
              type: 'string',
              required: true,
            },
          },
        },
      },
    },
  } as const
  const { schema } = parse(s)

  equal(
    validate(schema, 'user', {
      name: 'youri',
      address: {
        street: 'downtown',
      },
    }).valid,
    true,
  )

  equal(
    validate(schema, 'user', {
      name: 1,
    }).valid,
    false,
  )
})
