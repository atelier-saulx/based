import { BasedDb } from '../src/index.js'
import { equal } from './shared/assert.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test.skip('expire', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      token: {
        name: 'string',
        user: {
          ref: 'user',
          prop: 'token',
        },
      },
      user: {
        name: 'string',
        token: {
          ref: 'token',
          prop: 'user',
        },
      },
    },
  })

  const user1 = await db.create('user')
  const token1 = await db.create('token', {
    name: 'my token',
    user: user1,
  })

  db.expire('token', token1, 1)
  await db.drain()
  equal((await db.query('token').get().toObject()).length, 1)
  await setTimeout(1e3)
  equal((await db.query('token').get().toObject()).length, 0)

  const token2 = await db.create('token', {
    name: 'my new token',
    user: user1,
  })
  db.expire('token', token2, 1)
  await db.drain()

  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => {
    return db2.destroy()
  })
  await db2.start()

  equal((await db2.query('token').get().toObject()).length, 1)
  await setTimeout(1e3)
  equal((await db2.query('token').get().toObject()).length, 0)
})
