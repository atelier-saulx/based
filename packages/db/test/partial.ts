import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { throws } from './shared/assert.js'
import { makeTreeKey } from '../src/server/blockMap.js'

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

  const events1 = await db2
    .query('event')
    .include('extId')
    .range(0, 10)
    .get()
    .toObject()
  deepEqual(events1, [])

  for (let i = 1; i < 3 * 1025; i += 1025) {
    await db2.server.loadBlock('event', i)
    const events2 = await db2
      .query('event')
      .include('extId')
      .range(0, 10)
      .get()
      .toObject()
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
      { id: i + 9, extId: 100 },
    ])
    //db2.server.blockMap.foreachBlock((block) => console.log(block))

    await db2.server.unloadBlock('event', i)
    const events3 = await db2
      .query('event')
      .include('extId')
      .range(0, 10)
      .get()
      .toObject()
    deepEqual(events3, [])
  }
})

await test('invalid partial type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await throws(() =>
    db.setSchema({
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
    }),
  )
})

await test('simple load/unload', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      product: {
        blockCapacity: 100_000,
        props: {
          sku: 'number',
          flap: 'number',
        }
      },
    },
  })

  for (let i = 0; i < 300_000; i++) {
    let p = db.create('product', {
      sku: i,
      flap: i,
    })
  }

  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start({ noLoadDumps: true })
  t.after(() => db2.destroy())

  db2.server.blockMap.foreachBlock((block) => deepEqual(block.status === 'inmem', false))

  await db2.server.loadBlock('product', 1)

  const d1 = await db2
    .query('product')
    .include('*')
    .range(0, 100_000)
    .get()
    .toObject()

  deepEqual(d1.length, 100_000, 'first query')

  await db2.server.unloadBlock('product', 1)
  db2.server.blockMap.foreachBlock((block) => deepEqual(block.status === 'inmem', false))

  await db2.server.loadBlock('product', 100_001)
  deepEqual(db.server.blockMap.getBlock(makeTreeKey(db.server.schemaTypesParsed['product'].id, 100_001)).status, 'inmem')

  const d2 = await db2
    .query('product')
    .include('*')
    .range(0, 100_000)
    .get()
    .toObject()

  deepEqual(d2.length, 100_000, 'second query')

  await db2.server.unloadBlock('product', 100_001)
})
