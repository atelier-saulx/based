import test from 'ava'
import { BasedSchema, setWalker2, walk } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        name: {
          minLength: 3,
          maxLength: 6,
          type: 'string',
        },
        phonkName: {
          type: 'string',
          pattern: '\\${1,4}',
        },
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
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

test('walker', async (t) => {
  const x = await walk(
    {
      schema,
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

test.only('set walker', async (t) => {
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

  const x = await setWalker2(schema, {
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
