import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { fastPrng } from '@based/utils'

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

  const scriptName = process.env.npm_lifecycle_event || ''
  const isDebugMode = scriptName.includes('debug')
  const acceptableDuration = isDebugMode ? 300 : 30

  const q = await db.query('beer').sum('price').get()
  deepEqual(
    q.execTime < acceptableDuration,
    true,
    'Acceptable main agg performance',
  )

  const startTime2 = performance.now()
  await db.query('beer').groupBy('year').get()
  const elapsedTime2 = performance.now() - startTime2
  deepEqual(
    elapsedTime2 < acceptableDuration,
    true,
    'Acceptable group by main prop performance',
  )

  const startTime3 = performance.now()
  await db.query('beer').groupBy('type').get()
  const elapsedTime3 = performance.now() - startTime3
  deepEqual(
    elapsedTime3 < acceptableDuration,
    true,
    'Acceptable group by enum main performance',
  )

  const startTime4 = performance.now()
  await db.query('beer').max('price').groupBy('type').get()
  const elapsedTime4 = performance.now() - startTime4
  deepEqual(
    elapsedTime4 < acceptableDuration,
    true,
    'Acceptable agg + enum main group by performance',
  )
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
