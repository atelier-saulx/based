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

  db.create('trip', { driver: 'lala', distance: 10, rate: 5 })
  db.create('trip', { driver: 'lala', distance: 20, rate: 10 })
  db.create('trip', { driver: 'lele', distance: 40, rate: 10 })

  // console.log((await db.query('trip').include('distance').get()).debug())
  //   console.log(
  //     (
  //       await db.query('trip').hmean('distance').avg('distance').get()
  //     ).debug(),
  //   )

  //   console.log((await db.query('trip').sum('distance', 'rate').get()).debug())
  console.log(
    (await db.query('trip').filter('distance', '>', 10).get()).debug(),
  )
  console.log(
    (
      await db.query('trip').sum('distance').filter('distance', '>', 10).get()
    ).debug(),
  )
  console.log(
    (
      await db
        .query('trip')
        .sum('distance')
        .filter('rate', '>', 8)
        .groupBy('driver')
        .get()
    ).debug(),
  )

  await db.stop()
})

await test('references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      driver: {
        props: {
          name: 'string',
          trips: {
            items: {
              ref: 'trip',
              prop: 'driver', // Defines the inverse relationship
            },
          },
        },
      },
      trip: {
        props: {
          distance: 'number',
          rate: 'uint8',
          driver: {
            ref: 'driver',
            prop: 'trips', // Points back to the list on driver
          },
        },
      },
    },
  })

  const d1 = db.create('driver', {
    name: 'Luc Ferry',
  })
  db.drain()
  const t1 = db.create('trip', {
    distance: 523.1, // with uint16 => 523
    rate: 4,
    driver: d1,
  })
  const t2 = db.create('trip', {
    distance: 1230,
    rate: 2,
    driver: d1,
  })

  //   await db.query('trip').include('*', '**').get().inspect(10)

  // await db
  //   .query('driver')
  //   .include((t) => t('trips').include('distance'))
  //   .get()
  //   .inspect(10)

  const lala = await db
    .query('driver')
    .include((t) =>
      t('trips')
        .sum('distance')
        .avg('distance')
        .min('rate')
        .sum('rate')
        .count(),
    )
    .get()

  // console.log(lala.toObject())
  lala.inspect(10)
})
