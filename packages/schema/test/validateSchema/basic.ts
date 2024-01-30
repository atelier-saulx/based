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

test('root', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        // @ts-ignore
        wawa: true,
      },
    }),
    {
      errors: [{ code: ParseError.invalidProperty, path: ['root', 'wawa'] }],
    }
  )

  for (const key of ['directory', 'title', 'description']) {
    const result = await validateSchema({
      root: {
        // @ts-ignore
        [key]: true,
      },
    })
    t.deepEqual(result, {
      errors: [{ code: ParseError.incorrectFormat, path: ['root', key] }],
    })
  }

  t.deepEqual(
    await validateSchema({
      root: {
        prefix: 'wa',
      },
    }),
    {
      errors: [{ code: ParseError.incorrectFormat, path: ['root', 'prefix'] }],
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        // @ts-ignore
        prefix: true,
      },
    }),
    {
      errors: [{ code: ParseError.incorrectFormat, path: ['root', 'prefix'] }],
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        prefix: 'ro',
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        required: ['astring'],
      },
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        // @ts-ignore
        required: 'anotherString',
      },
    }),
    {
      errors: [
        { code: ParseError.incorrectFormat, path: ['root', 'required'] },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        $delete: true,
      },
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        // @ts-ignore
        $delete: 'aString',
      },
    }),
    {
      errors: [{ code: ParseError.incorrectFormat, path: ['root', '$delete'] }],
    }
  )
})
