import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify object', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        info: {
          type: 'object',
          props: {
            title: 'string',
            count: 'number',
          },
        },
      },
    },
  })

  const id1 = await db.create('thing', {
    info: {
      title: 'my title',
      count: 10,
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    info: {
      title: 'my title',
      count: 10,
    },
  })

  // Partial update of object
  await db.update('thing', id1, {
    info: {
      count: 20,
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    info: {
      title: 'my title',
      count: 20,
    },
  })

  // Delete nested prop
  await db.update('thing', id1, {
    info: {
      title: null,
    },
  })
  deepEqual((await db.query('thing', id1).get().toObject()).info, {
    count: 20,
  })

  // Delete whole object
  await db.update('thing', id1, {
    info: null,
  })
  deepEqual((await db.query('thing', id1).get().toObject()).info, undefined)
})

await test('modify object on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        info: { type: 'object', props: { a: 'string' } },
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeInfo: {
            type: 'object',
            props: {
              title: 'string',
              count: 'number',
            },
          },
        },
      },
    },
  })

  const targetId = await db.create('thing', { info: { a: 'a' } })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeInfo: {
        title: 'edge title',
        count: 5,
      },
    },
  })

  const res1 = await db
    .query('holder', id1)
    .include('toThing.$edgeInfo')
    .get()
    .toObject()

  deepEqual(res1.toThing?.$edgeInfo, {
    title: 'edge title',
    count: 5,
  })

  // Partial update
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeInfo: {
        count: 15,
      },
    },
  })

  const res2 = await db
    .query('holder', id1)
    .include('toThing.$edgeInfo')
    .get()
    .toObject()
  deepEqual(res2.toThing?.$edgeInfo, {
    title: 'edge title',
    count: 15,
  })
})
