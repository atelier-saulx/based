import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test('main + empty', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        role: ['admin', 'translator', 'viewer'],
        location: 'string',
      },
    },
  })

  const user1 = await db.create('user', {
    role: 'translator',
  })

  await db.update('user', user1, {
    location: '',
  })

  deepEqual(await db.query('user').get(), [
    { id: 1, role: 'translator', location: '' },
  ])
})
