import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify cardinality basic', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        counter: 'cardinality',
      },
    },
  })

  // Cardinality is a probabilistic counter.
  // We usually "add" values to it.
  const id1 = await db.create('thing', {
    counter: 'item1',
  })

  // Assuming we can read the count? Or the approximation.
  // The query might return the count.
  const res1 = await db.query2('thing', id1).get()
  deepEqual(res1?.counter, 1)

  // Add another unique item
  await db.update('thing', id1, {
    counter: 'item2',
  })
  const res2 = await db.query2('thing', id1).get()
  deepEqual(res2?.counter, 2)

  // Add duplicate item (count shouldn't change)
  await db.update('thing', id1, {
    counter: 'item1',
  })
  const res3 = await db.query2('thing', id1).get()
  deepEqual(res3?.counter, 2)

  // Delete
  await db.update('thing', id1, {
    counter: null,
  })

  const res4 = await db.query2('thing', id1).get()
  deepEqual(res4?.counter, 0)
})

await test('modify cardinality on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        counter: 'cardinality',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeCounter: 'cardinality',
        },
      },
    },
  })

  const targetId = await db.create('thing', { counter: 'a' })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeCounter: 'item1',
    },
  })

  const res1 = await db
    .query2('holder', id1)
    .include('toThing.$edgeCounter')
    .get()

  deepEqual(res1?.toThing?.$edgeCounter, 1)

  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeCounter: 'item2',
    },
  })

  const res2 = await db
    .query2('holder', id1)
    .include('toThing.$edgeCounter')
    .get()

  deepEqual(res2?.toThing?.$edgeCounter, 2)
})

await test('modify cardinality array', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        counter: 'cardinality',
      },
    },
  })

  // Create with array
  const id1 = await db.create('thing', {
    counter: ['item1', 'item2'],
  })

  const res1 = await db.query2('thing', id1).get()
  // Should have 2 unique items
  deepEqual(res1?.counter, 2)

  // Update with array (one new, one duplicate)
  await db.update('thing', id1, {
    counter: ['item2', 'item3'],
  })

  const res2 = await db.query2('thing', id1).get()
  // item1, item2, item3 -> 3 unique items
  deepEqual(res2?.counter, 3)
})
