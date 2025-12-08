import { BasedDb } from '../../../index.js'
;(async () => {
  const db = new BasedDb({
    path: './tmp',
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  await db.setSchema({
    types: {
      trip: {
        driver: 'string',
        distance: 'int32',
      },
    },
  })

  db.create('trip', { driver: 'Mr. Snurp', distance: 10 })
  db.create('trip', { driver: 'Ms. Blah', distance: 20 })

  console.log((await db.query('trip').include('driver').get()).debug())
  // console.log((await db.query('trip').sum('distance').get()).debug())

  await db.stop()
})()
