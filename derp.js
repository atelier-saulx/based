import { deepEqual } from 'node:assert'
import { BasedDb } from '@based/db'

await (async (t) => {
  console.time('total')
  console.time('setup')
  const db = new BasedDb({
    // path: null,
  })
  await db.start({ clean: true })

  await db.setSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
      },
    },
  })

  console.timeEnd('setup')

  console.time('test')

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

  console.timeEnd('test')

  console.time('cleanup')
  await db.stop(true)
  console.timeEnd('cleanup')
  console.timeEnd('total')
})()
