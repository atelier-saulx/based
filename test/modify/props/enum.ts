import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify enum', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        option: { enum: ['first', 'second', 'third'] },
      },
    },
  })

  const id1 = await db.create('thing', {
    option: 'first',
  })

  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    option: 'first',
  })

  await db.update('thing', id1, {
    option: 'second',
  })

  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    option: 'second',
  })

  // Delete
  await db.update('thing', id1, {
    option: null,
  })
  deepEqual((await db.query2('thing', id1).get())?.option, undefined)
})

await test('modify enum on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        option: { enum: ['a', 'b'] },
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeOption: { enum: ['first', 'second'] },
        },
      },
    },
  })

  const targetId = await db.create('thing', { option: 'a' })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeOption: 'first',
    },
  })

  const res1 = await db
    .query2('holder', id1)
    .include('toThing.$edgeOption')
    .get()

  deepEqual(res1?.toThing.$edgeOption, 'first')

  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeOption: 'second',
    },
  })

  const res2 = await db
    .query2('holder', id1)
    .include('toThing.$edgeOption')
    .get()
  deepEqual(res2?.toThing.$edgeOption, 'second')
})
