import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('kev', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        driver: 'string',
        distance: 'int32',
        rate: 'int8',
      },
    },
  })

  db.create('trip', { distance: 10, rate: 5 })
  db.create('trip', { distance: 20, rate: 10 })
  db.create('trip', { distance: 40, rate: 10 })

  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .include('distance')
  //       .filter('distance', '>', 10) // filter still doesn't work
  //       .get()
  //   ).debug(),
  // )
  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .sum('distance')
  //       .harmonicMean('distance')
  //       .avg('distance')
  //       .stddev('distance', { mode: 'population' })
  //       .get()
  //   ).debug(),
  // )
  console.log((await db.query('trip').count().get()).debug())

  await db.stop()
})
