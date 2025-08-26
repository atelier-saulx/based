import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { throws } from './shared/assert.js'

await test('partial', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      event: {
        blockCapacity: 1025,
        insertOnly: true,
        partial: true,
        props: {
          extId: 'uint32',
          vec: { type: 'colvec', size: 2, baseType: 'float32' },
        },
      },
    },
  })

  for (let i = 0; i < 3 * 1025; i++) {
    await db.create('event', {
      extId: 100,
      vec: new Float32Array([10, 20]),
    })
  }

  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  //t.after(() => t.backup(db2)) TODO Enable once auto loading works
  t.after(() => db2.destroy())

  const events1 = await db2.query('event').include('extId').range(0, 10).get().toObject()
  deepEqual(events1, [])

  for (let i = 1; i < 3 * 1025; i += 1025) {
    await db2.server.loadBlock('event', i)
    const events2 = await db2.query('event').include('extId').range(0, 10).get().toObject()
    deepEqual(events2, [
      { id: i + 0, extId: 100 },
      { id: i + 1, extId: 100 },
      { id: i + 2, extId: 100 },
      { id: i + 3, extId: 100 },
      { id: i + 4, extId: 100 },
      { id: i + 5, extId: 100 },
      { id: i + 6, extId: 100 },
      { id: i + 7, extId: 100 },
      { id: i + 8, extId: 100 },
      { id: i + 9, extId: 100 }
    ])
    //db2.server.verifTree.foreachBlock((block) => console.log(block))

    await db2.server.unloadBlock('event', i)
    const events3 = await db2.query('event').include('extId').range(0, 10).get().toObject()
    deepEqual(events3, [])
  }
})

await test('invalid partial type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await throws(() => db.setSchema({
    types: {
      ext: {
        props: {
          name: 'string',
          events: {
            items: {
              ref: 'event',
              prop: 'ext',
            },
          },
        },
      },
      event: {
        blockCapacity: 1000,
        insertOnly: true,
        partial: true,
        props: {
          ext: { ref: 'ext', prop: 'events' },
          vec: { type: 'colvec', size: 2 },
        },
      },
    },
  }))
})
