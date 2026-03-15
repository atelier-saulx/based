import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - json', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myJson: { type: 'json' },
      },
    },
  })

  // Json Valid Values
  await db.create('thing', { myJson: { a: 1 } })
  await db.create('thing', { myJson: [1, 2] })
  await db.create('thing', { myJson: 'string' })
  await db.create('thing', { myJson: 123 })
  await db.create('thing', { myJson: true })
  await db.create('thing', { myJson: null })

  // Json Invalid structure (Circular)
  const circular: any = { a: 1 }
  circular.b = circular
  await throws(
    () => db.create('thing', { myJson: circular }),
    'json should fail with circular structure',
  )
})
