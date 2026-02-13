import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - binary', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myBlob: { type: 'binary', maxBytes: 10 },
      },
    },
  })

  // Binary
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myBlob: 'not a buffer' }),
    'binary fail with string',
  )
  await throws(
    () => db.create('thing', { myBlob: new Uint8Array(20) }),
    'binary maxBytes',
  )
  await db.create('thing', { myBlob: new Uint8Array(5) })

  // Extended validation
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myBlob: 123 }),
    'binary fail with number',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myBlob: [1, 2, 3] }),
    'binary fail with array of numbers',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myBlob: {} }),
    'binary fail with object',
  )
})
