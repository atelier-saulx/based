import { setTimeout } from 'node:timers/promises'
import { DbClient, getDefaultHooks } from '../../src/index.js'
import { DbServer } from '../../src/sdk.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { testDbClient } from '../shared/index.js'

await test('saveInterval', async (t) => {
  const db = new DbServer({
    path: t.tmp,
    saveIntervalInSeconds: 1,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
    types: {
      user: {
        props: {
          externalId: 'alias',
          potato: 'string',
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  client.create('user', {
    externalId: 'cool',
    potato: 'fries',
  })

  client.create('user', {
    externalId: 'cool2',
    potato: 'wedge',
  })

  await client.drain()
  await setTimeout(1e3)

  const res1 = await client.query('user').get()

  await db.stop(true)

  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  const res2 = await client2.query('user').get()

  deepEqual(res1, res2)
})
