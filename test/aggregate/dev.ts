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
        distance: 'uint32',
        rate: 'int8',
      },
    },
  })

  db.create('trip', { driver: 'lala', distance: 10, rate: 5 })
  db.create('trip', { driver: 'lala', distance: 20, rate: 10 })
  db.create('trip', { driver: 'lele', distance: 40, rate: 10 })

  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .include('distance')
  //       .filter('distance', 'equalsU32', 10) // filter ongoing
  //       .get()
  //   ).debug(),
  // )

  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .sum('distance')
  //       .filter('distance', 'equalsU32', 10)
  //       .get()
  //   ).debug(),
  // )

  console.log(
    (
      await db
        .query('trip')
        .sum('distance')
        .harmonicMean('distance')
        .count()
        .avg('distance')
        .stddev('distance', { mode: 'population' })
        .get()
    ).debug(),
  )
  // console.log((await db.query('trip').count().get()).debug())
  // console.log((await db.query('trip').sum('distance').get()).debug())
  // console.log(
  //   (
  //     await db.query('trip').sum('distance').count().avg('distance').get()
  //   ).debug(),
  // )
  // console.log(
  //   (await db.query('trip').count().sum('distance', 'rate').get()).debug(), // this doesn't
  // )
  // console.log(
  //   (await db.query('trip').sum('distance').groupBy('driver').get()).debug(),
  // )

  // await db.stop()
})
