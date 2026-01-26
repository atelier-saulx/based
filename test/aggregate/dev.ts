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
  db.create('trip', { driver: 'lala', distance: 40, rate: 10 })

  // console.log(
  //   (
  //     await db.query('trip').stddev('distance', { mode: 'population' }).get()
  //   ).debug(),
  // )
  deepEqual(
    await db.query('trip').stddev('distance').get(),
    {
      distance: {
        stddev: 15.275252316519468,
      },
    },
    'stddev default',
  )
  deepEqual(
    await db.query('trip').stddev('distance', { mode: 'sample' }).get(),
    {
      distance: {
        stddev: 15.275252316519468,
      },
    },
    'stddev sample',
  )
  deepEqual(
    await db.query('trip').stddev('distance', { mode: 'population' }).get(),
    {
      distance: {
        stddev: 12.472191289246476,
      },
    },
    'stddev population',
  )
  deepEqual(
    await db
      .query('trip')
      .stddev('distance', { mode: 'population' })
      .groupBy('driver')
      .get(),
    {
      lala: {
        distance: {
          stddev: 12.472191289246476,
        },
      },
    },
    'stddev population',
  )

  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .include('distance')
  //       // .filter('distance', '>', 10) // filter ongoing
  //       .get()
  //   ).debug(),
  // )

  // console.log(
  //   (
  //     await db.query('trip').sum('distance').filter('distance', '>', 10).get()
  //   ).debug(),
  // )

  // console.log(
  //   (
  //     await db
  //       .query('trip')
  //       .sum('distance')
  //       .harmonicMean('distance')
  //       .count()
  //       .avg('distance')
  //       .stddev('distance', { mode: 'population' })
  //       .get()
  //   ).debug(),
  // )
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

await test('kkk', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        distance: 'uint32',
        rate: 'int8',
        driver: {
          ref: 'driver',
          prop: 'trips',
        },
      },
      driver: {
        name: 'string',
        power: 'uint8',
        trips: {
          items: {
            ref: 'trip',
            prop: 'driver',
          },
        },
      },
    },
  })

  const la = db.create('driver', { name: 'lala', power: 2 })
  const le = db.create('driver', { name: 'lele', power: 4 })
  db.drain()
  db.create('trip', { driver: la, distance: 10, rate: 5 })
  db.create('trip', { driver: le, distance: 20, rate: 10 })
  db.create('trip', { driver: la, distance: 40, rate: 10 })

  // console.log(await db.query('trip').include('*', '**').get().toObject())

  /*
   *    get the total distance travelled by driver
   */

  deepEqual(
    await db.query('trip').sum('distance').groupBy('driver').get(),
    {
      1: {
        distance: {
          sum: 50,
        },
      },
      2: {
        distance: {
          sum: 20,
        },
      },
    },
    'Group by reference',
  )

  // // works
  // await db
  //   .query('driver')
  //   .include((q) => q('trips').sum('distance'), 'name')
  //   .get()
  //   .inspect()

  // // also works, while is weird
  // await db
  //   .query('driver')
  //   .include((q) => q('trips').sum('distance').groupBy('driver'), 'name')
  //   .get()
  //   .inspect()

  // // crashes in debug mode
  // const r = await db
  //   .query('trip')
  //   .include((q) => q('driver').sum('power'))
  //   .get()

  // console.log(r.toObject())
})
