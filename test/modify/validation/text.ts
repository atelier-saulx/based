import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - text', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      de: true,
    },
    types: {
      thing: {
        myText: 'text',
      },
    },
  })

  // Text
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: 123 }),
    'text should fail with number',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: { en: 123 } }),
    'text value should fail with number',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: { xx: 'hello' } }),
    'text should fail with invalid locale',
  )
  await db.create('thing', { myText: { en: 'works' } })

  // Extended validation
  await throws(
    () => db.create('thing', { myText: 'hello' }),
    'text should fail if passed as string not object',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: { en: {} } }),
    'text value should fail with object',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: { en: [] } }),
    'text value should fail with array',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myText: [] }),
    'text should fail with array',
  )
})
