import test from 'ava'
import { BasedSchema, setWalker, walk } from '../src/index.js'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        priority: { type: 'number' },
        something: { type: 'string', format: 'strongPassword' },
      },
    },
    bla: {
      prefix: 'bl',
      fields: {
        referencesToThings: {
          type: 'references',
          allowedTypes: ['thing'],
        },
        referenceToThing: {
          type: 'reference',
          allowedTypes: ['thing'],
        },
        enum: {
          enum: ['tony', 'jim'],
        },
        exclusiveminmax: {
          type: 'number',
          minimum: 3,
          exclusiveMinimum: true,
          maximum: 6,
          exclusiveMaximum: true,
        },
        text: {
          type: 'text',
          pattern: '[^xz]{1,10}',
        },
        timestamp: {
          type: 'timestamp',
        },
        setOfNumbers: {
          type: 'set',
          items: {
            type: 'number',
          },
        },
        intarray: {
          type: 'array',
          items: {
            type: 'integer',
          },
        },
        object: {
          type: 'object',
          properties: {
            flap: { type: 'boolean' },
          },
        },
        name: {
          minLength: 3,
          maxLength: 6,
          type: 'string',
        },
        phonkName: {
          type: 'string',
          pattern: '\\${1,4}',
        },
        flap: {
          type: 'boolean',
        },
        x: {
          type: 'object',
          properties: {
            flap: {
              type: 'boolean',
            },
          },
        },
        record: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              bla: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    snux: {
                      type: 'object',
                      properties: {
                        x: {
                          type: 'number',
                        },
                      },
                    },
                    flap: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  translations: ['de', 'nl', 'ro', 'za', 'ae'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

test('backtracking', async (t) => {
  const results: any[] = []

  const setObj = {
    x: {
      y: {
        a: 10,
        bla: [1, 2, 3, 4, 5],
      },
      c: 40,
    },
  }

  await walk<{ lullz: true }>(
    schema,
    {
      init: async () => {
        return { target: { lullz: true } }
      },
      parsers: {
        keys: {},
        fields: {},
        any: async (args) => {
          args.collect()
          return args
        },
      },
      collect: (args) => {
        return args.path.join('.')
      },
      backtrack: (args, fromBt, collected) => {
        results.push({ path: args.path, bt: [...fromBt] })
        return fromBt.length ? fromBt : collected
      },
    },
    setObj
  )

  t.deepEqual(results, [
    { path: ['x', 'y', 'bla'], bt: [] },
    {
      path: ['x', 'y'],
      bt: [['x.y.bla.0', 'x.y.bla.1', 'x.y.bla.2', 'x.y.bla.3', 'x.y.bla.4']],
    },
    {
      path: ['x'],
      bt: [[['x.y.bla.0', 'x.y.bla.1', 'x.y.bla.2', 'x.y.bla.3', 'x.y.bla.4']]],
    },
    {
      path: [],
      bt: [
        [[['x.y.bla.0', 'x.y.bla.1', 'x.y.bla.2', 'x.y.bla.3', 'x.y.bla.4']]],
      ],
    },
  ])

  const results2: any[] = []

  await walk<{ lullz: true }>(
    schema,
    {
      init: async () => {
        return { target: { lullz: true } }
      },
      parsers: {
        keys: {},
        fields: {},
        any: async (args) => {
          args.collect()
          return { target: { lullz: true } }
        },
      },
      collect: (args) => {
        return args.path.join('.')
      },
      backtrack: (args, fromBt, collected) => {
        results2.push({ path: args.path, bt: [...fromBt] })
        return fromBt.length ? fromBt : collected
      },
    },
    setObj
  )

  t.deepEqual(results, results2)

  const results3: any[] = []

  let cnt = 0
  await walk<{ lullz: true }>(
    schema,
    {
      init: async () => {
        return { target: { lullz: true } }
      },
      parsers: {
        keys: {},
        fields: {},
        any: async (args) => {
          cnt++
          args.collect()
          return cnt % 2 ? args : { target: { lullz: true } }
        },
      },
      collect: (args) => {
        return args.path.join('.')
      },
      backtrack: (args, fromBt, collected) => {
        results3.push({ path: args.path, bt: [...fromBt] })
        return fromBt.length ? fromBt : collected
      },
    },
    setObj
  )

  t.deepEqual(results, results3)
})

test.only('parseTop update target', async (t) => {
  const parsed: { path: (number | string)[]; target: any }[] = []
  await walk<any>(
    schema,
    {
      init: async () => {
        return { target: { path: [] } }
      },
      parsers: {
        keys: {},
        fields: {},
        any: async (args) => {
          args.collect()
          if (args.prev.key !== args.key) {
            return {
              parseTopLevel: true,
              target: {
                path: args.path.join('.'),
                prevTarget: args.target.id,
                id: args.id,
              },
              value: args.value,
            }
          }
        },
      },
      collect: (args) => {
        parsed.push({ path: args.path, target: args.target })
        return args.path.join('.')
      },
    },
    {
      x: {
        y: {
          z: 'bla!',
        },
      },
    }
  )

  t.deepEqual(parsed, [
    { path: ['x'], target: { path: [] } },
    {
      path: ['x'],
      target: { path: 'x', prevTarget: undefined, id: 2 },
    },
    {
      path: ['x', 'y'],
      target: { path: 'x', prevTarget: undefined, id: 2 },
    },
    { path: ['x', 'y'], target: { path: 'x.y', prevTarget: 2, id: 4 } },
    {
      path: ['x', 'y', 'z'],
      target: { path: 'x.y', prevTarget: 2, id: 4 },
    },
    {
      path: ['x', 'y', 'z'],
      target: { path: 'x.y.z', prevTarget: 4, id: 6 },
    },
  ])
})

test.serial('perf setWalker', async (t) => {
  let d = Date.now()
  let collected = 0
  let errs = 0
  for (let i = 0; i < 1e5; i++) {
    const x = await setWalker(schema, {
      $id: 'bl120',
      name: 'blasdsdsd',
      x: { flap: true },
    })
    errs += x.errors.length
    collected += x.collected.length
  }
  d = Date.now() - d
  console.info('setting 200k', d, 'ms')
  t.true(d < 1e3)
})
