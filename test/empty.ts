import { DbServer } from '../src/sdk.js'
import { testDbClient } from './shared/index.js'
import test from './shared/test.js'

// TODO This is a dumb test because the db instance is not really initialized before it has a schema
await test.skip('empty db and no schema', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())
  await db.save()
})

await test('empty db and no nodes', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await testDbClient(db, {
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })
  await db.save()
})

await test('empty db and deleted nodes', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })

  const res = await client.create('user', {
    file: new Uint8Array([1, 3, 3, 7]),
  })
  await client.delete('user', res)

  await db.save()

  const res1 = await client.create('user', {
    file: new Uint8Array([1, 3, 3, 7]),
  })
  await db.save()
  await client.delete('user', res1)
  await db.save()
})
