import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify cardinality', async (t) => {
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
  const res1: any = await db.query('thing', id1).get()
  deepEqual(res1.counter, 1)

  // Add another unique item
  await db.update('thing', id1, {
    counter: 'item2',
  })
  const res2: any = await db.query('thing', id1).get()
  deepEqual(res2.counter, 2)

  // Add duplicate item (count shouldn't change)
  await db.update('thing', id1, {
    counter: 'item1',
  })
  const res3: any = await db.query('thing', id1).get()
  deepEqual(res3.counter, 2)

  // Add multiple items?
  // await db.update('thing', id1, {
  //   counter: ['item3', 'item4']
  // })
})
