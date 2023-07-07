import test from 'ava'
import { validateSchema } from '../src/index'

test.serial('throw on invalid schema', async (t) => {
  const prefixError = t.throws(() => {
    validateSchema({
      types: {
        bla: {
          prefix: 'fix',
          fields: {},
        },
      },
    })
  })

  t.is(
    prefixError.message,
    'Incorrect prefix "fix" for type "bla" has to be a string of 2 alphanumerical characters e.g. "Az", "ab", "cc", "10"'
  )
})
