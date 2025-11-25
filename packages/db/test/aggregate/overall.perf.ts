import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { deepEqual } from '../shared/assert.js'
import { fastPrng } from '../../src/utils/index.js'
import { equal } from 'node:assert'

await test('overall performance', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const types = ['IPA', 'Lager', 'Ale', 'Stout', 'Wit', 'Dunkel', 'Tripel']
  await db.setSchema({
    types: {
      beer: {
        props: {
          name: 'string',
          type: types,
          price: 'number',
          bitterness: 'number',
          alchol: 'number',
          year: 'number',
        },
      },
    },
  })

  const beers = 1e6
  const years = [1940, 1990, 2013, 2006]
  const rnd = fastPrng()
  for (let i = 0; i < beers; i++) {
    await db.create('beer', {
      name: 'Beer' + i,
      type: types[rnd(0, types.length - 1)],
      price: Math.random() * 100,
      year: years[rnd(0, years.length - 1)],
    })
  }
  await db.drain()

  await perf(async () => {
    await db.query('beer').sum('price').get()
  }, 'main agg')

  await perf(async () => {
    await db.query('beer').groupBy('year').get()
  }, 'group by year')

  await perf(async () => {
    await db.query('beer').groupBy('type').get()
  }, 'group by enum main')

  await perf(async () => {
    await db.query('beer').max('price').groupBy('type').get()
  }, 'agg + enum main group by')
})

await test('count top level bignumber', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      sequence: {
        bla: 'uint32',
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('sequence', { bla: i })
  }

  await db.drain()

  const q = await db.query('sequence').count().get()
  equal(q.toObject().count, 1e6)
})
