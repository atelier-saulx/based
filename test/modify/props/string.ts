import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

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

  // Delete
  await db.update('thing', id1, {
    name: null,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    name: '', // Should probably be empty string for string props?
  })
})

await test('modify string on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeName: 'string',
        },
      },
    },
  })

  // Basic string
  const s1 = 'hello'
  const targetId = await db.create('thing', { name: 'target' })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeName: s1,
    },
  })

  const res1 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()

  deepEqual(res1.toThing?.$edgeName, s1)

  // Update to another string
  const s2 = 'world'
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeName: s2,
    },
  })
  const res2 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()
  deepEqual(res2.toThing?.$edgeName, s2)

  // String with spaces
  const s3 = 'foo bar'
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeName: s3,
    },
  })
  const res3 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()
  deepEqual(res3.toThing?.$edgeName, s3)

  // Empty string
  const s4 = ''
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeName: s4,
    },
  })
  const res4 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()
  deepEqual(res4.toThing?.$edgeName, s4)

  // Unicode / Special characters
  const s5 = 'ñàéïô SPECIAL !@#$%^&*()_+ 123'
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeName: s5,
    },
  })
  const res5 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()
  deepEqual(res5.toThing?.$edgeName, s5.normalize('NFD'))

  // Long string
  const s6 = 'a'.repeat(1000)
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeName: s6,
    },
  })
  const res6 = await db
    .query('holder', id1)
    .include('toThing.$edgeName')
    .get()
    .toObject()
  deepEqual(res6.toThing?.$edgeName, s6)
})
