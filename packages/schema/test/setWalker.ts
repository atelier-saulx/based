import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        visits: {
          type: 'cardinality',
        },
        blub: {
          type: 'number',
        },
        flap: {
          type: 'number',
        },
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
        setje: {
          type: 'set',
          items: { type: 'number' },
        },
        specialArray: {
          type: 'array',
          values: {
            type: 'string',
          },
        },
        snurpArray: {
          type: 'array',
          values: {
            type: 'number',
          },
        },
        powerLevel: {
          type: 'integer',
        },
        bla: {
          type: 'boolean',
        },
        time: {
          type: 'timestamp',
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
            snurp: {
              type: 'reference',
            },
            things: {
              enum: ['yuzi', 'jux', 'mr tony', 9000],
            },
            blub: {
              type: 'set',
              items: { type: 'string' },
            },
            json: {
              type: 'json',
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
  const now = Date.now()
  await setWalker(
    schema,
    {
      $id: 'bl1',
      visits: {
        flap: true,
        snurp: false,
        ua: '123435',
      },
      blub: {
        $increment: 1,
      },
      bla: false,
      time: now,
      setje: [1, 2, 3],
      form: {
        lastName: 'de beer',
        bla: ['bl123', 'bl234'],
        blab: { $add: ['bl456'] },
        blub: ['x'],
        json: { bla: 1, x: 2, y: 3 },
        snurp: 'blx12',
        things: 'mr tony',
        password: 'mypassword!',
      },
      snurpArray: {
        $assign: {
          $idx: 0,
          $value: 100,
        },
      },
      specialArray: {
        $insert: {
          $value: ['a', 'b', 'c'],
          $idx: 0,
        },
      },
      snurp: [
        {
          x: [1, 2, 3],
        },
      ],
    },
    {
      collect: ({ path, value, typeSchema, fieldSchema, target }) => {
        results.push({
          path,
          value,
        })
      },
      checkRequiredFields: async (path) => {
        return true
      },
      referenceFilterCondition: async (id, filter) => {
        return true
      },
    }
  )

  const result = [
    { path: ['visits'], value: '3a9009740ee' },
    { path: ['blub'], value: { $increment: 1 } },
    { path: ['time'], value: now },
    { path: ['form', 'snurp'], value: 'blx12' },
    {
      path: ['snurpArray', 0],
      value: 100,
    },
    { path: ['bla'], value: false },
    { path: ['form', 'lastName'], value: 'de beer' },
    { path: ['form', 'json'], value: '{"bla":1,"x":2,"y":3}' },
    { path: ['form', 'things'], value: 2 },
    { path: ['form', 'password'], value: 'mypassword!' },
    { path: ['form', 'bla'], value: { $value: ['bl123', 'bl234'] } },
    { path: ['form', 'blab'], value: { $add: ['bl456'] } },
    { path: ['setje'], value: { $value: [1, 2, 3] } },
    { path: ['form', 'blub'], value: { $value: ['x'] } },
    {
      path: ['specialArray'],
      value: { $insert: { $value: ['a', 'b', 'c'], $idx: 0 } },
    },
    { path: ['snurp'], value: { $delete: true } },
    { path: ['snurp', 0, 'x'], value: { $delete: true } },
    { path: ['snurp', 0, 'x', 0], value: 1 },
    { path: ['snurp', 0, 'x', 1], value: 2 },
    { path: ['snurp', 0, 'x', 2], value: 3 },
  ]

  t.deepEqual(results, result)

  const results2: any[] = []
  await setWalker(
    schema,
    {
      $id: 'bl1',
      blub: {
        $value: 4,
      },
      flap: {
        $default: 1,
      },
    },
    {
      collect: ({ path, value, typeSchema, fieldSchema, target }) => {
        results2.push({
          path,
          value,
        })
      },
      checkRequiredFields: async (path) => {
        return false
      },
      referenceFilterCondition: async (id, filter) => {
        return true
      },
    }
  )

  t.deepEqual(results2, [
    { path: ['blub'], value: { $value: 4 } },
    { path: ['flap'], value: { $default: 1 } },
  ])

  const results3: any[] = []
  await setWalker(
    schema,
    {
      $id: 'bl1',
      snurpArray: {
        $push: 1,
      },
      specialArray: {
        $push: { $value: 'flap' },
      },
    },
    {
      collect: ({ path, value, typeSchema, fieldSchema, target }) => {
        results3.push({
          path,
          value,
        })
      },
      checkRequiredFields: async (path) => {
        return false
      },
      referenceFilterCondition: async (id, filter) => {
        return true
      },
    }
  )

  t.deepEqual(results3, [
    { path: ['snurpArray'], value: { $push: [1] } },
    { path: ['specialArray'], value: { $push: [{ $value: 'flap' }] } },
  ])
})

test('required', async (t) => {
  const schema: BasedSchema = {
    types: {
      bla: {
        prefix: 'bl',
        required: ['blub', 'flap', 'snurp'],
        fields: {
          blub: {
            type: 'number',
          },
          flap: {
            type: 'number',
          },
          snurp: {
            type: 'object',
            required: ['x'],
            properties: {
              x: {
                type: 'object',
                required: ['a', 'b', 'c'],
                properties: {
                  a: { type: 'string' },
                  b: { type: 'string' },
                  c: { type: 'string' },
                },
              },
            },
          },
          array: {
            type: 'array',
            values: {
              type: 'object',
              required: ['a', 'b', 'c'],
              properties: {
                a: { type: 'string' },
                b: { type: 'string' },
                c: { type: 'string' },
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

  const t1 = await setWalker(
    schema,
    {
      type: 'bla',
      blub: 1,
      flap: 1,
      snurp: {
        x: { a: 'b' },
      },
    },
    {
      collect: ({ path, value, typeSchema, fieldSchema, target }) => {},
      checkRequiredFields: async (paths) => {
        return true
      },
      referenceFilterCondition: async (id, filter) => {
        return true
      },
    }
  )

  t.deepEqual(t1.required, [
    ['snurp', 'x', 'b'],
    ['snurp', 'x', 'c'],
  ])

  const t2 = await setWalker(
    schema,
    {
      type: 'bla',
      array: [
        {
          a: 'hello', // say cant set non existing field
        },
      ],
    },
    {
      collect: ({ path, value, typeSchema, fieldSchema, target }) => {},
      checkRequiredFields: async (paths) => {
        // should be [snurp.x.b, snurp.x.c]
        return true
      },
      referenceFilterCondition: async (id, filter) => {
        return true
      },
    }
  )

  t.deepEqual(t2.required, [
    ['array', 0, 'b'],
    ['array', 0, 'c'],
    ['blub'],
    ['flap'],
    ['snurp'],
  ])

  t.true(true)
})
