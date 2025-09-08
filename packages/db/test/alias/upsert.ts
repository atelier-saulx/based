import { BasedDb, DbClient, getDefaultHooks } from '../../src/index.js'
import { equal } from '../shared/assert.js'
import test from '../shared/test.js'

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

  await Promise.all([
    client1.upsert('user', {
      uuid: 'x',
      one: 1,
    }),
    client2.upsert('user', {
      uuid: 'x',
      two: 2,
    }),
  ])

  equal(
    await db.query('user').get(),
    [
      {
        id: 1,
        two: 0,
        one: 1,
        uuid: 'x',
      },
    ],
    'upsert is atomic',
  )
})
