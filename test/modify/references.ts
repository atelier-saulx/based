import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

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

  const t1 = await db.create('thing', { name: 't1' })
  const t2 = await db.create('thing', { name: 't2' })
  const h1 = await db.create('holder', { dest: t1 })

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: t1 },
    })
  }

  await db.update('holder', h1, { dest: t2 })

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: t2 },
    })
  }

  await db.update('holder', h1, { dest: { id: t1 } })

  {
    const res = await db.query('holder', h1).include('dest.id').get().toObject()
    deepEqual(res, {
      id: h1,
      dest: { id: t1 },
    })
  }
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

  const t1 = await db.create('thing', { name: 't1' })
  const t2 = await db.create('thing', { name: 't2' })
  const t3 = await db.create('thing', { name: 't3' })

  // Test set (create)
  const h1 = await db.create('holder', { dests: [t1, t2] })

  const check = async (ids: number[], msg) => {
    const res = await db.query('holder', h1).include('dests').get().toObject()
    const currentIds = res.dests?.map((v: any) => v.id) || []
    currentIds.sort()
    ids.sort()
    deepEqual(currentIds, ids, msg)
  }

  await check([t1, t2], 'simple')

  // Test add
  await db.update('holder', h1, { dests: { add: [t3] } })
  await check([t1, t2, t3], 'add')

  // Test delete
  await db.update('holder', h1, { dests: { delete: [t2] } })
  await check([t1, t3], 'delete')

  // Test replace (array)
  await db.update('holder', h1, { dests: [t2] })
  await check([t2], 'replace')

  // Test update (acts as add/upsert for references list)
  await db.update('holder', h1, { dests: { update: [t3] } })
  await check([t2, t3], 'update')
})
