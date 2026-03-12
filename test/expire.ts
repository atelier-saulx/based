import { DbClient, DbServer, getDefaultHooks } from '../src/index.js'
import { equal } from './shared/assert.js'
import { deepEqual } from '../src/utils/index.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'
import { testDbClient } from './shared/index.js'

await test('expire', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const schema = {
    types: {
      token: {
        name: 'string',
        user: {
          ref: 'user',
          prop: 'token',
        },
        expiresAt: {
          type: 'timestamp',
          expire: true,
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
  } as const
  const client = await testDbClient(db, schema)

  const user1 = await client.create('user', {})
  const token1 = await client.create('token', {
    name: 'my token',
    user: user1,
  })

  await client.update('token', token1, { expiresAt: Date.now() + 1e3 })
  equal((await client.query('token').get()).length, 1)
  await setTimeout(2e3)
  equal((await client.query('token').get()).length, 0)

  const token2 = await client.create('token', {
    name: 'my new token',
    user: user1,
  })
  await client.update('token', token2, { expiresAt: Date.now() + 1e3 })

  await db.save()
  equal((await client.query('token').get()).length, 1, '1 token before save')
  const db2 = new DbServer({
    path: t.tmp,
  })
  t.after(() => db2.destroy(), true)
  await db2.start()
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  equal((await client2.query('token').get()).length, 1, '1 token after load')
  await setTimeout(3e3)
  equal((await client2.query('token').get()).length, 0, '0 tokens after expiry')
})

await test('refresh', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      user: {
        props: {
          name: 'string',
          deleteBy: {
            type: 'timestamp',
            expire: true,
          },
        },
      },
    },
  })

  const id1 = await client.create('user', {
    name: 'dude',
  })
  client.update('user', id1, { deleteBy: Date.now() + 1e3 })
  client.update('user', id1, { deleteBy: Date.now() + 3e3 })
  await client.drain()
  await setTimeout(1100)
  deepEqual(await client.query('user', id1).get(), { id: 1, name: 'dude' })
})
