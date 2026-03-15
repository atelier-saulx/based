import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - timestamp', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myTs: { type: 'timestamp', min: 1000, max: 2000 },
      },
    },
  })

  // Timestamp
  await throws(() => db.create('thing', { myTs: 500 }), 'timestamp too small')
  await throws(() => db.create('thing', { myTs: 3000 }), 'timestamp too large')
  await db.create('thing', { myTs: 1500 })

  // Range validation (min: 1000, max: 2000)
  await throws(
    () => db.create('thing', { myTs: 999 }),
    'timestamp should fail below min',
  )
  await throws(
    () => db.create('thing', { myTs: 2001 }),
    'timestamp should fail above max',
  )
  await db.create('thing', { myTs: 1000 })
  await db.create('thing', { myTs: 2000 })

  // Extended validation
  await throws(
    () => db.create('thing', { myTs: '2022-01-01' }),
    'timestamp should fail with date string',
  )
  await throws(
    () => db.create('thing', { myTs: NaN }),
    'timestamp should fail with NaN',
  )
  await throws(
    () => db.create('thing', { myTs: Infinity }),
    'timestamp should fail with Infinity',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myTs: true }),
    'timestamp should fail with boolean',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myTs: {} }),
    'timestamp should fail with object',
  )
})
