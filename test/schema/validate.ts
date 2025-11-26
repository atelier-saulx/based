import { deepEqual, equal, test } from '../shared/index.js'
import { parse, validate } from '@based/sdk'

await test('validate', async () => {
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

await test('validate - messages', async () => {
  const { schema } = parse({
    types: {
      user: {
        name: 'string',
        email: {
          type: 'string',
          format: 'email',
        },
        age: {
          type: 'uint8',
          min: 18,
          max: 120,
          validation: (val) =>
            (18 <= val && val <= 120) || 'Expected age between 18 and 120',
        },
      },
    },
  })

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      age: 17,
    }),
    {
      valid: false,
      errors: [
        {
          path: ['age'],
          value: 17,
          error: 'Expected age between 18 and 120',
        },
      ],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      age: 17,
      email: 'not-an-email',
    }),
    {
      errors: [
        {
          error: 'Invalid value',
          path: ['email'],
          value: 'not-an-email',
        },
        {
          error: 'Expected age between 18 and 120',
          path: ['age'],
          value: 17,
        },
      ],
      valid: false,
    },
  )
})

await test('validate - reference', async () => {
  const { schema } = parse({
    types: {
      user: {
        name: 'string',
        bff: {
          ref: 'user',
          prop: 'bff',
        },
      },
    },
  })

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      bff: 1,
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      bff: { id: 1 },
    }),
    {
      valid: true,
      errors: [],
    },
  )
})

await test('validate - references', async () => {
  const { schema } = parse({
    types: {
      user: {
        name: 'string',
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: [1],
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: [{ id: 1 }],
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: {
        add: [{ id: 1 }],
      },
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: {
        update: [{ id: 1 }],
      },
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: {
        delete: [{ id: 1 }],
      },
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: {
        add: [{ id: 1 }],
        update: [{ id: 1 }],
        delete: [{ id: 1 }],
      },
    }),
    {
      valid: true,
      errors: [],
    },
  )

  deepEqual(
    validate(schema, 'user', {
      name: 'youri',
      friends: {
        add: [{ id: 1 }],
        update: [{ id: 1 }],
        delete: [{ id: 1 }],
        onknown: [],
      },
    }).valid,
    false,
  )
})
