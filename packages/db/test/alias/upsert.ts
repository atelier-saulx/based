import { BasedDb, DbClient, getDefaultHooks } from '../../src/index.ts'
import { equal } from '../shared/assert.ts'
import test from '../shared/test.ts'

await test('alias upsert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          uuid: 'alias',
          one: 'number',
          two: 'number',
        },
      },
    },
  })

  const client1 = db.client
  const client2 = new DbClient({
    hooks: getDefaultHooks(db.server),
  })

  const ids = await Promise.all([
    client1.create('user', {
      uuid: 'a',
    }),
    client1.upsert('user', {
      uuid: 'x',
      one: 1,
    }),
    client1.create('user', {
      uuid: 'b',
    }),
    client2.create('user', {
      uuid: 'c',
    }),
    client2.upsert('user', {
      uuid: 'x',
      two: 2,
    }),
    client2.create('user', {
      uuid: 'd',
    }),
  ])

  const results = await db.query('user').get()

  equal(
    results,
    [
      { id: 1, two: 0, one: 0, uuid: 'a' },
      { id: 2, two: 2, one: 1, uuid: 'x' },
      { id: 3, two: 0, one: 0, uuid: 'b' },
      { id: 4, two: 0, one: 0, uuid: 'c' },
      { id: 5, two: 0, one: 0, uuid: 'd' },
    ],
    'upsert is atomic',
  )

  equal(ids, [1, 2, 3, 4, 2, 5])
})
