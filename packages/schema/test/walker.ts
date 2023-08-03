import test from 'ava'
import { BasedSchema, setWalker, walk } from '../src/index'
import { wait } from '@saulx/utils'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
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
          values: {
            type: 'integer',
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
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
        },
      },
    },
  },
  $defs: {},
  languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

test('walker', async (t) => {
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

  console.log('--------------------------------------')
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

  console.log('--------------------------------------')
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

test('set walker', async (t) => {
  const schema: BasedSchema = {
    types: {
      bla: {
        prefix: 'bl',
        fields: {
          record: {
            type: 'record',
            values: {
              type: 'cardinality',
            },
          },
          array: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                uniqMap: {
                  type: 'record',
                  values: {
                    type: 'cardinality',
                  },
                },
                bla: { type: 'boolean' },
              },
            },
          },
          uniq: { type: 'cardinality' },
          snup: { type: 'boolean' },
          flap: {
            type: 'object',
            required: ['durp'],
            properties: {
              durp: { type: 'boolean' },
              gurt: { type: 'boolean' },
              durpi: {
                enum: ['yuzi', 'jux', 'mr tony', 9000],
              },
              x: {
                type: 'array',
                values: {
                  type: 'boolean',
                },
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

  const x = await setWalker(schema, {
    $id: 'bl1',
    snup: false,
    uniq: {
      $value: 'wpeojwepojfewpio',
    },
    record: {
      a: 1000,
      b: 'bla',
      c: { x: 'snap', y: 'flap' },
      bla: { $value: { a: true, b: false } },
    },
    flap: {
      gurt: true,
      durpi: {
        $value: 'jux',
      },
      x: [
        true,
        false,
        false,
        true,
        { $value: false },
        { $default: true, $value: false },
      ],
    },
    array: {
      $insert: {
        $idx: 2,
        $value: {
          bla: false,
          uniqMap: {
            a: false,
            b: { $value: { a: true, b: true }, c: { x: true } },
          },
        },
      },
    },
  })

  console.info('------------', x)
  t.true(true)
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

test('string', async (t) => {
  // for (let i = 0; i < 10; i++) {
  //   console.log(
  //     (await setWalker(schema, { $id: 'bl120', name: 'blax' })).target
  //       .collected
  //   )
  // }

  // console.info('----------')
  // console.log(
  //   (await setWalker(schema, { $id: 'bl120', name: { $value: 'blax' } }))
  //     .target.collected
  // )
  console.info('---- default ------')
  const x = await setWalker(schema, {
    $id: 'bl120',
    name: { $default: 'blax' },
  })

  // TODO: Error also has to include path
  console.log(
    x.errors,
    x.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- default too many fields ------')
  const y = await setWalker(schema, {
    $id: 'bl120',
    name: { $default: 'blax', meanboys: true },
  })

  // TODO: Error also has to include path
  console.log(
    y.errors,
    y.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('----  ------')
  const z = await setWalker(schema, {
    $id: 'bl120',
    exclusiveminmax: { $default: 10, $decrement: 10 },
  })

  console.log(
    z.errors,
    z.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink ------')
  const j = await setWalker(schema, {
    $id: 'bl120',
    exclusiveminmax: { $default: 4, $decrement: 10 },
  })

  console.log(
    j.errors,
    j.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 2 ------')
  const c = await setWalker(schema, {
    $id: 'bl120',
    exclusiveminmax: { $default: 4, $decrement: 10, flapperdeflip: true },
  })

  console.log(
    c.errors,
    c.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 3 ------')
  const g = await setWalker(schema, {
    $id: 'bl120',
    timestamp: { $default: 4 },
  })

  console.log(
    g.errors,
    g.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 4 ------')
  const d = await setWalker(schema, {
    $id: 'bl120',
    exclusiveminmax: { $value: 4 },
  })

  console.log(
    d.errors,
    d.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 5 ------')
  let r = await setWalker(schema, {
    $id: 'bl120',
    text: { $value: 'x' },
  })

  console.log(
    r.errors,
    r.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 6 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $value: 'sdsdds' },
  })

  console.log(
    r.errors,
    r.collected.map((v) => ({ path: v.path, value: v.value }))
  )

  console.info('---- doink 7 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds' },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 8 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds', en: { $default: 'flapflap' } },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 9 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: { de: 'dsnfds' }, en: { $default: 'flapflap' } },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  t.true(true)

  console.info('---- doink 10 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $default: { de: 'dsnfds' },
      nl: 'flapperonus',
      en: { $default: 'flapflap' },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 11 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $default: { de: 'dsnfds' },
      nl: 'flapperonus',
      ro: { $value: 'durp' },
      en: { $default: 'flapflap' },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 12 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $value: 'durp',
      nl: 'flapperonus',
      $default: {
        ae: 'habibi',
      },
      ro: { $value: 'durp' },
      en: { $default: 'flapflap' },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 13 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $value: 'xz',
      nl: 'flapperonus',
      $default: {
        ae: 'habibi',
      },
      ro: { $value: 'durp' },
      en: { $default: 'xzxz' },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 14 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $value: 'xz',
      nl: 'flapperonus',
      $default: {
        ae: 'habibi',
      },
      ro: { $value: 'durp' },
      en: { $default: 'xzxz' },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 15 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: [1, 2, 3, 4, 5],
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 16 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $add: 20 },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 17 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $add: [1, 2, 3, 4, 5, 6] },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 18 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $remove: [1, 2, 3, 4, 5, 6] },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 19 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'sdfefewfewfewewffwe',
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 20 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'tibla',
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 21 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referenceToThing: 'blbla',
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 22 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: ['blbla', 'ti123', 'ewiohfdoweihfw'],
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 23 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $remove: ['ti123'] },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 24 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $add: ['blbla', 'ti123', 'ewiohfdoweihfw'] },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 25 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    referencesToThings: { $add: 'ti123' },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 26 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        $value: 6,
      },
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 27 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $push: [1, 2, 3, 4, 5],
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 28 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $unshift: [1, 2, 3, 4, 5],
    },
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 29 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      en: 'bla',
    },
  })

  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  t.true(true)

  console.info('---- doink 30 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      $delete: true,
    },
  })

  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 31 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $delete: true,
  })

  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 32 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $alias: 'bla',
  })

  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 33 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    $alias: ['bla'],
  })

  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 34 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: 'tony',
  })

  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  console.info('---- doink 35 ------')
  r = await setWalker(schema, {
    $id: 'bl120',
    integer: NaN,
  })

  console.dir(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  t.true(true)
})
