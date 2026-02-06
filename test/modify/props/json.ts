import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify json', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        data: 'json',
      },
    },
  })

  const obj = { foo: 'bar', baz: 123, list: [1, 2] }
  const id1 = await db.create('thing', {
    data: obj,
  })

  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    data: obj,
  })

  const arr = ['a', 'b', 'c']
  await db.update('thing', id1, {
    data: arr,
  })

  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    data: arr,
  })

  // Delete
  await db.update('thing', id1, {
    data: null,
  })
  deepEqual((await db.query2('thing', id1).get()).data, null)
})

await test('modify json on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        data: 'json',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeData: 'json',
        },
      },
    },
  })

  const obj = { foo: 'bar' }
  const targetId = await db.create('thing', { data: {} })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeData: obj,
    },
  })

  const res1 = await db.query2('holder', id1).include('toThing.$edgeData').get()

  deepEqual(res1.toThing?.$edgeData, obj)

  const obj2 = { baz: 'qux' }
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeData: obj2,
    },
  })

  const res2 = await db.query2('holder', id1).include('toThing.$edgeData').get()
  deepEqual(res2.toThing?.$edgeData, obj2)
})
