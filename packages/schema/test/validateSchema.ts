import test from 'ava'
import { validateSchema } from '../src/index.js'

test.serial('throw on invalid schema', async (t) => {
  const prefixError = t.throws(() => {
    validateSchema({
      $defs: {
        yuzi: {
          type: 'string',
          title: 'BLA',
          description: 'SNURP',
        },
      },
      types: {
        bla: {
          prefix: 'fix',
          fields: {
            yuzi: {
              type: 'object',
              customValidator: async (_value, _path, _target) => {
                return true
              },
              properties: {
                gurt: {
                  $ref: '/$defs/yuzi',
                },
                flap: {
                  enum: ['bla', 'blap', 'flip'],
                },
              },
            },
          },
        },
      },
    })
  })
  t.is(
    prefixError.message,
    'Incorrect prefix "fix" for type "bla" has to be a string of 2 alphanumerical characters e.g. "Az", "ab", "cc", "10"'
  )
})
