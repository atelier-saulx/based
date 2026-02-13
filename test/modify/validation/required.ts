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
  await throws(
    () =>
      // @ts-expect-error
      db.create('thing', {
        description: 'stuff',
        nested: { reqInNested: 'yes' },
      }),
    'fail missing required top-level',
  )

  // 2. Required object itself missing
  await throws(
    () =>
      // @ts-expect-error
      db.create('thing', {
        name: 'cool',
        // nested is missing
      }),
    'fail missing required object',
  )

  // 3. Required nested field missing (in required object)
  await throws(
    () =>
      db.create('thing', {
        name: 'cool',
        // @ts-expect-error
        nested: {}, // reqInNested missing
      }),
    'fail missing required nested field',
  )

  // 4. Required nested field missing (in optional object, if object is provided)
  await throws(
    () =>
      db.create('thing', {
        name: 'cool',
        nested: { reqInNested: 'yes' },
        // @ts-expect-error
        optionalNested: {}, // reqInOptional missing
      }),
    'fail missing required nested field in optional object',
  )

  // 5. Success cases
  const id1 = await db.create('thing', {
    name: 'cool',
    nested: { reqInNested: 'yes' },
    // optionalNested is optional, so this is valid
  })

  const id2 = await db.create('thing', {
    name: 'cool',
    nested: { reqInNested: 'yes' },
    optionalNested: { reqInOptional: 'also yes' },
  })

  // 6. Update should not trigger required validation
  // @ts-ignore
  await db.update('thing', id1, { description: 'updated' })

  // Update nested field without others
  // @ts-ignore
  await db.update('thing', id2, { nested: { reqInNested: 'updated' } })
})
