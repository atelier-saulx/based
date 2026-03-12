import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { deepEqual } from './shared/assert.js'

await test('serialize', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
      },
    },
  })

  db.create('user', {})
  db.create('user', {
    isNice: true,
  })

  db.create('user', {
    isNice: false,
  })

  await db.drain()

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  deepEqual(await db.query('user').filter('isNice', '=', true).get(), [
    { id: 2, isNice: true },
  ])

  deepEqual(await db.query('user').filter('isNice', '=', false).get(), [
    { id: 1, isNice: false },
    { id: 3, isNice: false },
  ])
})
