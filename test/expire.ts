import { BasedDb, DbClient, getDefaultHooks } from '../src/index.js'
import { equal } from './shared/assert.js'
import { deepEqual } from '../src/utils/index.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('expire', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db.server))

  const schema = {
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
  } as const
  const client = await db.setSchema(schema)

  const user1 = await client.create('user', {})
  const token1 = await client.create('token', {
    name: 'my token',
    user: user1,
  })

  client.expire('token', token1, 1)
  await client.drain()
  equal((await client.query2('token').get()).length, 1)
  await setTimeout(2e3)
  equal((await client.query2('token').get()).length, 0)

  const token2 = await client.create('token', {
    name: 'my new token',
    user: user1,
  })
  await client.expire('token', token2, 1)
  await client.drain()
  await db.save()
  equal((await client.query2('token').get()).length, 1, '1 token before save')
  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy(), true)
  await db2.start()
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2.server),
  })

  equal((await client2.query2('token').get()).length, 1, '1 token after load')
  await setTimeout(3e3)
  equal(
    (await client2.query2('token').get()).length,
    0,
    '0 tokens after expiry',
  )
})

await test('refresh', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db.server))

  const client = await db.setSchema({
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
  await client.expire('user', id1, 1)
  await client.drain()
  await client.expire('user', id1, 3)
  await db.drain()
  await setTimeout(1100)
  deepEqual(await client.query2('user', id1).get(), { id: 1, name: 'dude' })
})
