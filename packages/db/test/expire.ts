import { BasedDb } from '../src/index.js'
import { equal } from './shared/assert.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('expire', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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
})
