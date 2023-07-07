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
  setWalker(
    schema,
    {
      $id: 'bl1',
      form: {
        lastName: 'de beer',
      },
      snurp: [
        {
          x: [1, 2, 3],
        },
      ],
    },
    (path, value, typeSchema, fieldSchema) => {
      console.info(path, value, typeSchema, fieldSchema)
    }
  )

  // 'form.lastName' 'de beer', { bla }, { lastName field}

  // 'snurp[0]x[0]' 1, { bla }, { type number }
  // 'snurp[0]x[1]' 2, { bla }, { lastName field}
  // 'snurp[0]x[2]' 3, { bla }, { lastName field}
})
