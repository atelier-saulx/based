import { BasedDb } from '../src/index.js'
import { equal } from './shared/assert.js'
import { deepEqual } from '@based/utils'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('expire', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

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
  await setTimeout(2e3)
  equal((await db.query('token').get().toObject()).length, 0)

  const token2 = await db.create('token', {
    name: 'my new token',
    user: user1,
  })
  await db.expire('token', token2, 1)
  await db.drain()
  await db.save()
  equal(
    (await db.query('token').get().toObject()).length,
    1,
    '1 token before save',
  )
  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy(), true)
  await db2.start()

  equal(
    (await db2.query('token').get().toObject()).length,
    1,
    '1 token after load',
  )
  await setTimeout(3e3)
  equal(
    (await db2.query('token').get().toObject()).length,
    0,
    '0 tokens after expiry',
  )
})

await test('refresh', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
        },
      },
    },
  })

  const id1 = await db.create('user', {
    name: 'dude',
  })
  await db.expire('user', id1, 1)
  await db.drain()
  await db.expire('user', id1, 3)
  await db.drain()
  await setTimeout(1100)
  deepEqual(await db.query('user', id1).get(), { id: 1, name: 'dude' })
})

await test('expire-alot', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          other: {
            ref: 'user',
            prop: 'other',
          },
        },
      },
    },
  })

  const id1 = await db.create('user', {
    name: 'dude',
  })

  const id2 = await db.create('user', {
    name: 'dude2',
    other: id1,
  })

  let i = 100
  while (i--) {
    db.expire('user', id1, 604_800_000)
    db.expire('user', id2, 604_800_000)
  }

  db.save()

  await db.drain()
  await setTimeout(2000)

  console.log(await db.query('user').get())
})
