import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - enum', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myEnum: { enum: ['a', 'b'] },
        numEnum: { enum: [1, 2, 3] },
        mixedEnum: { enum: ['a', 1] },
      },
    },
  })

  // Enum (string)
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: 'c' }),
    'enum should fail with invalid value',
  )
  await db.create('thing', { myEnum: 'b' })

  // Enum (number)
  await throws(
    // @ts-expect-error
    () => db.create('thing', { numEnum: 4 }),
    'numEnum should fail with invalid value',
  )
  await db.create('thing', { numEnum: 2 })

  // Enum (mixed)
  await throws(
    // @ts-expect-error
    () => db.create('thing', { mixedEnum: 'b' }),
    'mixedEnum should fail with invalid string value',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { mixedEnum: 2 }),
    'mixedEnum should fail with invalid number value',
  )
  await db.create('thing', { mixedEnum: 'a' })
  await db.create('thing', { mixedEnum: 1 })

  // Extended validation
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: 'A' }),
    'enum should be case sensitive',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: 1 }),
    'enum should fail with number',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: true }),
    'enum should fail with boolean',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: [] }),
    'enum should fail with array',
  )
})
