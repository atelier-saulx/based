import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - string', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: { type: 'string', min: 2, max: 5 },
        myString: { type: 'string' },
      },
    },
  })

  // String
  await throws(
    // @ts-expect-error
    () => db.create('thing', { name: 123 }),
    'string should fail with number',
  )
  await throws(
    () => db.create('thing', { name: 'a' }),
    'string should fail if too short',
  )
  await throws(
    () => db.create('thing', { name: 'aaaaaa' }),
    'string should fail if too long',
  )
  await db.create('thing', { name: 'abc' })

  // Extended validation
  await throws(
    // @ts-expect-error
    () => db.create('thing', { name: ['a'] }),
    'string should fail with array',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { name: {} }),
    'string should fail with object',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { name: true }),
    'string should fail with boolean',
  )
})
