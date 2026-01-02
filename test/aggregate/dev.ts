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

  // console.log((await db.query('trip').include('distance').get()).debug())
  console.log(
    (await db.query('trip').var('distance').get()).debug(),
    //.avg('distance') // 3rd func
    // max being changed when using hmean in a joint query
  )

  await db.stop()
})
