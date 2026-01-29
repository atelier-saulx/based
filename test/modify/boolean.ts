import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('modify boolean', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        isNice: 'boolean',
      },
    },
  })

  const a = db.create('user', {})
  const b = db.create('user', { isNice: true })
  const c = db.create('user', { isNice: false })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  db.update('user', a, { isNice: true })
  db.update('user', b, { isNice: true })
  db.update('user', c, { isNice: true })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: true },
    { id: 2, isNice: true },
    { id: 3, isNice: true },
  ])

  db.update('user', a, { isNice: false })
  db.update('user', b, { isNice: false })
  db.update('user', c, { isNice: false })

  deepEqual(await db.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: false },
    { id: 3, isNice: false },
  ])
})
