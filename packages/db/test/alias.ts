import { deepEqual } from 'node:assert'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('alias', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          externalId: 'alias',
          potato: 'string',
        },
      },
    },
  })

  const user1 = db.create('user', {
    externalId: 'cool',
  })

  const user2 = db.create('user', {
    externalId: 'cool2',
  })

  db.drain()

  deepEqual((await db.query('user', user1).get()).toObject(), {
    id: 1,
    externalId: 'cool',
    potato: '',
  })

  deepEqual((await db.query('user', user2).get()).toObject(), {
    id: 2,
    externalId: 'cool2',
    potato: '',
  })

  deepEqual(
    (await db.query('user').filter('externalId', '=', 'cool').get()).toObject(),
    [
      {
        id: 1,
        externalId: 'cool',
        potato: '',
      },
    ],
  )

  deepEqual(
    (
      await db.query('user').filter('externalId', 'has', 'cool').get()
    ).toObject(),
    [
      {
        id: 1,
        externalId: 'cool',
        potato: '',
      },
      {
        id: 2,
        externalId: 'cool2',
        potato: '',
      },
    ],
  )

  const res1 = await db.upsert(
    'user',
    {
      externalId: 'potato',
    },
    {
      externalId: 'potato',
      potato: 'success',
    },
  )

  deepEqual((await db.query('user', res1).get()).toObject(), {
    id: 3,
    externalId: 'potato',
    potato: 'success',
  })

  const res2 = await db.upsert(
    'user',
    {
      externalId: 'potato',
    },
    {
      externalId: 'potato',
      potato: 'wrong',
    },
  )

  deepEqual((await db.query('user', res2).get()).toObject(), {
    id: 3,
    externalId: 'potato',
    potato: 'wrong',
  })
})
