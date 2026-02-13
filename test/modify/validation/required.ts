import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - required', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: { type: 'string', required: true },
        description: { type: 'string' },
        nested: {
          type: 'object',
          required: true,
          props: {
            reqInNested: { type: 'string', required: true },
          },
        },
        optionalNested: {
          type: 'object',
          props: {
            reqInOptional: { type: 'string', required: true },
          },
        },
      },
    },
  })
  // 1. Top-level required
  const throwsMatch = async (fn: () => Promise<any>, re: RegExp) => {
    try {
      await fn()
    } catch (err: any) {
      if (re.test(err.message)) return
      throw new Error(`Error message "${err.message}" does not match ${re}`)
    }
    throw new Error('Function should have thrown')
  }

  // 1. Top-level required
  await throwsMatch(
    () =>
      // @ts-expect-error
      db.create('thing', {
        description: 'stuff',
        nested: { reqInNested: 'yes' },
      }),
    /Field name is required/,
  )

  // 2. Required object itself missing
  await throwsMatch(
    () =>
      // @ts-expect-error
      db.create('thing', {
        name: 'cool',
        // nested is missing
      }),
    /Field nested is required/,
  )

  // 3. Required nested field missing (in required object)
  await throwsMatch(
    () =>
      db.create('thing', {
        name: 'cool',
        // @ts-expect-error
        nested: {}, // reqInNested missing
        optionalNested: {
          reqInOptional: 'xx',
        },
      }),
    /Field nested\.reqInNested is required/,
  )

  // 4. Required nested field missing (in optional object, if object is provided)
  await throwsMatch(
    () =>
      db.create('thing', {
        name: 'cool',
        nested: { reqInNested: 'yes' },
        // @ts-expect-error
        optionalNested: {}, // reqInOptional missing
      }),
    /Field optionalNested.reqInOptional is required/,
  )

  const id1 = await db.create('thing', {
    name: 'cool',
    nested: { reqInNested: 'yes' },
    optionalNested: { reqInOptional: 'also yes' },
  })

  // 6. Update should not trigger required validation
  // @ts-ignore
  await db.update('thing', id1, { description: 'updated' })

  // Update nested field without others
  // @ts-ignore
  await db.update('thing', id1, { nested: { reqInNested: 'updated' } })
})
