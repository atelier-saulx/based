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
  const x = await walk(
    schema,
    {
      init: async (args) => {
        return { ...args, target: { lullz: true } }
      },
      parsers: {
        keys: {
          // $list: async (args) => {
          //   return {
          //     ...args,
          //     value: { flapdrol: true },
          //   }
          // },
        },
        fields: {
          // string: () => {}
        },
        any: async (args) => {
          args.collect(args)
          return args
        },
      },
      collect: (args) => {
        return args.path.join('.')
      },
      backtrack: (args, fromBt, collected) => {
        console.log(
          '    \n-----------BACK TRACK GOOD GO',
          '\n',
          'path:',
          args.path.join('.'),
          '\n',
          'backtracked:',
          JSON.stringify(fromBt),
          '\n',
          'collected:',
          collected,
          '--------------------'
        )
        return fromBt.length ? fromBt : collected
      },
    },
    {
      gurk: [1, 2, 3, 4],
      x: {
        y: {
          z: {
            a: 10,
            b: 20,
            gur: {
              x: true,
              y: true,
              $list: {
                $sort: true,
              },
            },
            c: 40,
            $list: true,
          },
        },
      },
    }
  )

  console.info('------------')

  t.true(true)
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

test('perf setWalker', async (t) => {
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
  t.true(d < 1e3)
})

test.only('string', async (t) => {
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

  r.collected.forEach((v) => {
    console.info(v.root.typeSchema)
  })

  console.log(r.errors)
  console.dir(
    r.collected.map((v) => ({ path: v.path, value: v.value })),
    { depth: 10 }
  )

  t.true(true)
})
