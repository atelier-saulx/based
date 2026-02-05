import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify single reference', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        dest: { type: 'reference', ref: 'thing', prop: 'refHolders' },
      },
    },
  })

  // Test passing BasedModify (promise) directly
  const t1 = db.create('thing', { name: 't1' })
  const t2 = db.create('thing', { name: 't2' })
  const h1 = await db.create('holder', { dest: t1 })

  const realT1 = await t1
  const realT2 = await t2

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: realT1 },
    })
  }

  // Update with promise
  await db.update('holder', h1, { dest: t2 })

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: realT2 },
    })
  }

  // Update with object format containing promise
  await db.update('holder', h1, { dest: { id: t1 } })

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: realT1 },
    })
  }

  // Delete
  await db.update('holder', h1, { dest: null })
  deepEqual(await db.query('holder', h1).include('dest').get(), {
    id: h1,
    dest: null,
  })
})

await test('modify references', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        dests: {
          type: 'references',
          items: {
            ref: 'thing',
            prop: 'refsHolders',
          },
        },
      },
    },
  })

  // Mixed awaited and not awaited
  const t1 = await db.create('thing', { name: 't1' })
  const t2Promise = db.create('thing', { name: 't2' })
  const t2 = await t2Promise
  const t3Promise = db.create('thing', { name: 't3' })
  const t3 = await t3Promise

  // Test set (create) with mixed
  const h1 = await db.create('holder', { dests: [t1, t2Promise] })

  const check = async (ids: number[], msg) => {
    const res = await db.query('holder', h1).include('dests').get().toObject()
    const currentIds = res.dests?.map((v: any) => v.id) || []
    currentIds.sort()
    ids.sort()
    deepEqual(currentIds, ids, msg)
  }

  await check([t1, t2], 'simple')

  // Test add with promise
  await db.update('holder', h1, { dests: { add: [t3Promise] } })
  await check([t1, t2, t3], 'add')

  // Test delete with promise
  await db.update('holder', h1, { dests: { delete: [t2Promise] } })
  await check([t1, t3], 'delete')

  // Test replace (array) with promise
  await db.update('holder', h1, { dests: [t2Promise] })
  await check([t2], 'replace')

  // Test update (acts as add/upsert for references list) with promise
  await db.update('holder', h1, { dests: { update: [t3Promise] } })
  await check([t2, t3], 'update')

  // Delete all
  await db.update('holder', h1, { dests: null })
  await check([], 'delete all')
})

await test('modify references no await', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        dests: {
          type: 'references',
          items: {
            ref: 'thing',
            prop: 'refsHolders',
          },
        },
      },
    },
  })

  // No await on creates
  const t1 = db.create('thing', { name: 't1' })
  const t2 = db.create('thing', { name: 't2' })
  const t3 = db.create('thing', { name: 't3' })

  // Use unawaited t1, t2 in create
  const h1 = db.create('holder', { dests: [t1, t2] })

  // Use unawaited t3 in update, on unawaited h1
  const updateP = db.update('holder', h1, { dests: { add: [t3] } })

  // Also delete t2 (unawaited) from unawaited h1
  const deleteP = db.update('holder', h1, { dests: { delete: [t2] } })

  // Now we wait for the final state to settle.
  await Promise.all([t1, t2, t3, h1, updateP, deleteP])
  // Get real IDs for assertion
  const id1 = await t1
  const id3 = await t3 // t2 was deleted

  // Verify
  const res = await db
    .query('holder', await h1)
    .include('dests.id')
    .get()
    .toObject()

  const currentIds = res.dests?.map((v: any) => v.id) || []
  currentIds.sort()
  const expected = [id1, id3]
  expected.sort()

  deepEqual(currentIds, expected, 'no await sequence')
})

await test('modify single reference on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeRef: {
            type: 'reference',
            ref: 'thing',
          },
        },
      },
    },
  })

  const t1 = await db.create('thing', { name: 't1' })
  const t2 = await db.create('thing', { name: 't2' })
  const target = await db.create('thing', { name: 'target' })

  const h1 = await db.create('holder', {
    toThing: {
      id: target,
      $edgeRef: t1,
    },
  })

  // Verify
  const getEdgeRef = async (id: number) => {
    const res = await db
      .query('holder', id)
      .include('toThing.$edgeRef.id')
      .get()
      .toObject()
    return res.toThing && !Array.isArray(res.toThing)
      ? res.toThing.$edgeRef
      : undefined
  }

  deepEqual((await getEdgeRef(h1))?.id, t1)

  // Update
  await db.update('holder', h1, {
    toThing: {
      id: target,
      $edgeRef: t2,
    },
  })
  deepEqual((await getEdgeRef(h1))?.id, t2)

  // Update with object format
  await db.update('holder', h1, {
    toThing: {
      id: target,
      $edgeRef: { id: t1 },
    },
  })
  deepEqual((await getEdgeRef(h1))?.id, t1)
})

await test('modify references on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: 'string',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeRefs: {
            type: 'references',
            items: {
              ref: 'thing',
              // prop: 'edgeRefsHolders',
            },
          },
        },
      },
    },
  })

  // Mixed awaited and not awaited
  const t1 = await db.create('thing', { name: 't1' })
  const t2Promise = db.create('thing', { name: 't2' })
  const t2 = await t2Promise
  const t3Promise = db.create('thing', { name: 't3' })
  const t3 = await t3Promise
  const target = await db.create('thing', { name: 'target' })

  const h1 = await db.create('holder', {
    toThing: {
      id: target,
      $edgeRefs: [t1, t2Promise],
    },
  })

  const check = async (ids: number[], msg) => {
    const res = await db
      .query('holder', h1)
      .include('toThing.$edgeRefs.id')
      .get()
      .toObject()

    const edge = res.toThing && !Array.isArray(res.toThing) ? res.toThing : {}
    const currentIds = edge.$edgeRefs?.map((v: any) => v.id) || []
    currentIds.sort()
    ids.sort()
    deepEqual(currentIds, ids, msg)
  }

  await check([t1, t2], 'simple')

  // Test add with promise
  await db.update('holder', h1, {
    toThing: { id: target, $edgeRefs: { add: [t3Promise] } },
  })
  await check([t1, t2, t3], 'add')

  // Test delete with promise
  await db.update('holder', h1, {
    toThing: { id: target, $edgeRefs: { delete: [t2Promise] } },
  })
  await check([t1, t3], 'delete')

  // Test replace (array) with promise
  await db.update('holder', h1, {
    toThing: { id: target, $edgeRefs: [t2Promise] },
  })
  await check([t2], 'replace')
})
