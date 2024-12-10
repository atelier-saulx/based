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

  await setTimeout(1e3)
  const user1 = db.create('user', {
    externalId: 'cool',
  })

  db.drain()

  deepEqual((await db.query('user', user1).get()).toObject(), {
    id: 1,
    externalId: 'cool',
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
    ],
  )

  await db.upsert(
    'user',
    {
      externalId: 'potato',
    },
    {
      potato: 'success',
    },
  )

  db.drain()

  deepEqual(
    (
      await db.query('user').filter('externalId', '=', 'potato').get()
    ).toObject(),
    [
      {
        id: 2,
        externalId: 'potato',
        potato: 'success',
      },
    ],
  )

  deepEqual((await db.query('user').get()).toObject(), [
    {
      id: 1,
      externalId: 'cool',
      potato: '',
    },
    {
      id: 2,
      externalId: 'potato',
      potato: 'success',
    },
  ])

  // db.update('user', user1, {
  //   externalId: 'tornado',
  // })

  // db.drain()

  // const res2 = await db.query('user', user1).get()
  // const res3 = await db.query('user').filter('externalId', '=', 'cool').get()
  // const res4 = await db.query('user').filter('externalId', '=', 'tornado').get()

  // db.update('user', user1, {
  //   externalId: null,
  // })

  // db.drain()

  // const res5 = await db.query('user', user1).get()
  // const res6 = await db.query('user').filter('externalId', '=', 'tornado').get()

  // // console.log({ res1, res2, res3, res4, res5, res6 })
  // // const res2 = db.query('user', user1).get()

  // await setTimeout(100)
})
