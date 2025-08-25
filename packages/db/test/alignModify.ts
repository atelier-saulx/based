import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('alignModify - putrefs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const flushModify = db.client.hooks.flushModify

  db.client.hooks.flushModify = (buf) => {
    const shifted = new Uint8Array(buf.byteLength + 1)
    shifted.set(buf, 1)
    return flushModify(shifted.subarray(1))
  }

  await db.setSchema({
    types: {
      user: {
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  const user1 = await db.create('user')
  const user2 = await db.create('user')
  await db.create('user', {
    friends: [user1, user2],
  })

  const res = await db.query('user').get().toObject()

  deepEqual(res.length, 3)
})
