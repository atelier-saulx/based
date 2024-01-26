import anyTest, { TestFn } from 'ava'
import { validateSchema } from '../../src/validateSchema/index.js'
import { ParseError } from '../../src/error.js'

const test = anyTest as TestFn<{}>

test('invalid properties in schema root should fail', async (t) => {
  // @ts-ignore
  t.deepEqual(await validateSchema({ invalidProperty: true }), {
    errors: [{ code: ParseError.invalidProperty, path: ['invalidProperty'] }],
  })
})
