import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        snurp: {
          type: 'array',
          values: {
            type: 'object',
            properties: {
              x: {
                type: 'array',
                values: {
                  type: 'number',
                },
              },
            },
          },
        },
        form: {
          title: 'A registration form',
          description: 'A simple form example.',
          type: 'object',
          required: ['firstName', 'lastName'],
          properties: {
            bla: {
              type: 'references',
            },
            blab: {
              type: 'references',
            },
            firstName: {
              type: 'string',
              title: 'First name',
              default: 'Chuck',
            },
            lastName: {
              type: 'string',
              title: 'Last name',
            },
            age: {
              type: 'integer',
              title: 'Age',
            },
            bio: {
              type: 'string',
              title: 'Bio',
            },
            password: {
              type: 'string',
              title: 'Password',
              minLength: 3,
            },
            telephone: {
              type: 'string',
              title: 'Telephone',
              minLength: 10,
            },
          },
        },
      },
    },
  },
  $defs: {},
  languages: ['en'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
  },
}

test.serial('collect correctly', async (t) => {
  const results: { path: (string | number)[]; value: any }[] = []

  setWalker(
    schema,
    {
      $id: 'bl1',
      form: {
        lastName: 'de beer',
        bla: ['bl123', 'bl234'],
        blab: { $add: ['bl456'] },
      },
      snurp: [
        {
          x: [1, 2, 3],
        },
      ],
    },
    (path, value, typeSchema, fieldSchema) => {
      results.push({
        path,
        value,
      })
    }
  )

  const result = [
    { path: ['form', 'lastName'], value: 'de beer' },
    { path: ['form', 'bla'], value: ['bl123', 'bl234'] },
    { path: ['form', 'blab'], value: { $add: ['bl456'] } },
    { path: ['snurp', 0, 'x', 0], value: 1 },
    { path: ['snurp', 0, 'x', 1], value: 2 },
    { path: ['snurp', 0, 'x', 2], value: 3 },
  ]

  t.deepEqual(results, result)
})
