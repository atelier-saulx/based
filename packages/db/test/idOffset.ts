import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('idOffset', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 100,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  })

  let i = 10
  while (i--) {
    const userId = await db.create('user', {})

    if (Math.random() > 0.5) {
      db.update('user', userId, {
        name: 'user' + i,
      })
    }
  }

  await db.drain()
  const allUsers1 = await db.query('user').get().toObject()
  let id = 0

  for (const user of allUsers1) {
    id++
    if (user.id !== id) {
      console.log('incorrect', user, 'expected', id)
      throw new Error('incorrect id sequence')
    }
  }
})
