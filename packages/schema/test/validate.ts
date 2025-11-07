import test from 'node:test'
import { equal } from 'node:assert'
import { parse } from '@based/schema'
import { validate } from '../src/index.js'

await test('validate', () => {
  const { schema } = parse({
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
        badValidator: {
          type: 'number',
          validation: () => true,
        },
      },
    },
  })

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

  equal(
    validate(schema, 'user', {
      badValidator: 'snurk',
    }).valid,
    false,
    'Also checks default validation',
  )
})
