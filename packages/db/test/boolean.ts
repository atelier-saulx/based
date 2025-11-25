import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('boolean', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  // t.after(() => t.backup(db))
  t.after(() => db.stop(true))

  await db.setSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
      },
    },
  })

  const user1 = await db.create('user', {})

  db.create('user', {
    isNice: true,
  })

  db.create('user', {
    isNice: false,
  })

  await db.drain()

  deepEqual((await db.query('user').get()).toObject(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  deepEqual(
    (await db.query('user').filter('isNice', '=', true).get()).toObject(),
    [{ id: 2, isNice: true }],
  )

  deepEqual((await db.query('user').filter('isNice').get()).toObject(), [
    { id: 2, isNice: true },
  ])

  deepEqual((await db.query('user').filter('isNice', false).get()).toObject(), [
    { id: 1, isNice: false },
    { id: 3, isNice: false },
  ])
})
