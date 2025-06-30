import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('main + empty', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  deepEqual(await db.query('user').get().toObject(), [
    { id: 1, role: 'translator', location: '' },
  ])
})
