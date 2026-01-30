import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('modify string', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
    },
  })

  // Basic string
  const s1 = 'hello'
  const id1 = await db.create('thing', {
    name: s1,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s1,
  })

  // Update to another string
  const s2 = 'world'
  await db.update('thing', id1, {
    name: s2,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s2,
  })

  // String with spaces
  const s3 = 'foo bar'
  await db.update('thing', id1, {
    name: s3,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s3,
  })

  // Empty string
  const s4 = ''
  await db.update('thing', id1, {
    name: s4,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s4,
  })

  // Unicode / Special characters
  const s5 = 'ñàéïô SPECIAL !@#$%^&*()_+ 123'
  await db.update('thing', id1, {
    name: s5,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s5.normalize('NFD'),
  })

  // Long string
  const s6 = 'a'.repeat(1000)
  await db.update('thing', id1, {
    name: s6,
  })
  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: s6,
  })
})
