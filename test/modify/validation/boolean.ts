import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - boolean', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        isActive: { type: 'boolean' },
      },
    },
  })

  // Boolean
  await throws(
    // @ts-expect-error
    () => db.create('thing', { isActive: 'true' }),
    'boolean should fail with string',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { isActive: 1 }),
    'boolean should fail with number',
  )
  await db.create('thing', { isActive: true })

  // Extended validation

  await throws(
    // @ts-expect-error
    () => db.create('thing', { isActive: {} }),
    'boolean should fail with object',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { isActive: [] }),
    'boolean should fail with array',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { isActive: 'false' }),
    'boolean should fail with "false" string',
  )
})
