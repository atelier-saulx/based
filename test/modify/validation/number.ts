import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - number', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        score: { type: 'number', min: 10, max: 20 },
        myNumber: { type: 'number' },
      },
    },
  })

  // Number
  await throws(
    // @ts-expect-error
    () => db.create('thing', { score: '123' }),
    'number should fail with string',
  )
  await throws(
    () => db.create('thing', { score: 9 }),
    'number should fail if too small',
  )
  await throws(
    () => db.create('thing', { score: 21 }),
    'number should fail if too large',
  )
  await db.create('thing', { score: 15 })

  // Extended validation
  await throws(
    () => db.create('thing', { score: NaN }),
    'number should fail with NaN',
  )
  await throws(
    () => db.create('thing', { score: Infinity }),
    'number should fail with Infinity',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { score: true }),
    'number should fail with boolean',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { score: [] }),
    'number should fail with array',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { score: {} }),
    'number should fail with object',
  )
})
