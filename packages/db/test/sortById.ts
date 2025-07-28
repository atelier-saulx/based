import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('sort by id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  // only special pathway is DESC

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: `user ${i}`,
    })
  }

  const dbTime = await db.drain()

  console.log('dbTime', dbTime)

  await db.query('user').sort('id', 'desc').get().inspect(1000)
})
