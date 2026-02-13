import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - enum', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myEnum: { enum: ['a', 'b'] },
      },
    },
  })

  // Enum
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myEnum: 'c' }),
    'enum should fail with invalid value',
  )
  await db.create('thing', { myEnum: 'b' })

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
