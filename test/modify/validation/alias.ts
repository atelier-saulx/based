import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - alias', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myAlias: { type: 'alias' },
      },
    },
  })

  // Alias
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myAlias: 123 }),
    'alias fail with number',
  )

  // Extended validation
  await throws(
    () => db.create('thing', { myAlias: '' }),
    'alias fail with empty string',
  )
  await throws(
    () => db.create('thing', { myAlias: '   ' }),
    'alias fail with spaces string', // often desirable to prevent
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myAlias: ['a'] }),
    'alias fail with array',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myAlias: {} }),
    'alias fail with object',
  )
})
