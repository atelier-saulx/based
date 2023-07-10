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

// $value
// array ops
// $noRoot
// $delete -> change for set / references
// $merge: false,

// $increment

// $assign
// $insert
// $remove
// $push: 7,
// $unshift (    $unshift: {$value: 123,$maxLen: 10,},)

// $default
//     $alias: 'maTestWithAlias',
// aliases (set

test.serial('collect correctly', async (t) => {
  // $remove.$idx] for array

  /*
    $assign: {
        $idx: 0,
        $value: {
          name: 'FLURP!',
        },
      },
  */

  const results: { path: (string | number)[]; value: any }[] = []
  await setWalker(
    schema,
    {
      $id: 'bl1',
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
          $value: 100, // or { $increment: 10 }
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
      collect: (path, value, typeSchema, fieldSchema) => {
        console.info({
          path,
          value,
        })
        results.push({
          path,
          value,
        })
      },
      referenceFilterCondition: async () => {
        return true
      },
    }
  )

  const result = [
    { path: ['form', 'lastName'], value: 'de beer' },
    { path: ['form', 'json'], value: '{"bla":1,"x":2,"y":3}' },
    { path: ['form', 'snurp'], value: 'blx12' },
    { path: ['form', 'things'], value: 2 },
    { path: ['form', 'password'], value: 'mypassword!' },
    { path: ['snurp', 0, 'x', 0], value: 1 },
    { path: ['snurp', 0, 'x', 1], value: 2 },
    { path: ['snurp', 0, 'x', 2], value: 3 },
    { path: ['form', 'bla'], value: ['bl123', 'bl234'] },
    { path: ['form', 'blab'], value: { $add: ['bl456'] } },
    { path: ['form', 'blub'], value: ['x'] },
  ]

  t.deepEqual(results, result)
})
