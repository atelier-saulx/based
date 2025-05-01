import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('enumBug', async (t) => {
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

  console.log('----CREATE')
  const user1 = await db.create('user', {
    role: 'translator',
  })

  console.log(await db.query('user').get().toObject())
  console.log('----UPDATE')
  await db.update('user', user1, {
    location: '',
  })

  console.log(await db.query('user').get().toObject())

  deepEqual(await db.query('user').get().toObject(), [
    { id: 1, role: 'translator', location: '' },
  ])
})
