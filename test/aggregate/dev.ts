import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('sum top level', async (t) => {
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
      },
    },
  })

  db.create('trip', { driver: 'Mr. Snurp', distance: 10 })
  db.create('trip', { driver: 'Ms. Blah', distance: 20 })

  //   console.log((await db.query('trip').include('driver').get()).debug())
  console.log((await db.query('trip').sum('distance').get()).debug())

  await db.stop()
})
