import test from 'ava'
import { BasedSchema, validateType, walk } from '../src/index'

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
        console.log('init!\n', args)
        return { ...args, target: { lullz: true } }
      },
      parsers: {
        keys: {
          $list: async (args) => {
            return {
              ...args,

              value: { flapdrol: true },
            }
          },
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
      backtrack: (args, collectedCommands) => {
        console.log('    \n-----------BACK TRACK GOOD GO', collectedCommands)
        // if return next btrack will not receive  backtrack from commands
        return collectedCommands
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
  console.info(x)

  t.true(true)
})