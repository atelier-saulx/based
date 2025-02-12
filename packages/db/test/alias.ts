import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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

  await db.drain()

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

  // console.log (db.create)

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

  const res1 = await db.upsert('user', {
    externalId: 'potato',
    potato: 'success',
  })

  deepEqual((await db.query('user', res1).get()).toObject(), {
    id: 3,
    externalId: 'potato',
    potato: 'success',
  })

  const res2 = await db.upsert('user', {
    externalId: 'potato',
    potato: 'wrong',
  })

  deepEqual((await db.query('user', res2).get()).toObject(), {
    id: 3,
    externalId: 'potato',
    potato: 'wrong',
  })
})

await test('alias - references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'alias',
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
          },
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  await db.upsert('user', {
    name: 'youri',
    email: 'youri@saulx.com',
    bestFriend: {
      upsert: {
        email: 'jim@saulx.com',
      },
    },
    friends: {
      upsert: [
        {
          email: 'jim@saulx.com',
          name: 'jim',
        },
      ],
    },
  })

  deepEqual(
    await db.query('user').include('friends').get().toObject(),
    [
      {
        friends: [
          {
            email: 'jim@saulx.com',
            id: 2,
            name: 'jim',
          },
        ],
        id: 1,
      },
      {
        friends: [
          {
            email: 'youri@saulx.com',
            id: 1,
            name: 'youri',
          },
        ],
        id: 2,
      },
    ],
    'simple',
  )

  await db.upsert('user', {
    name: 'Youri',
    email: 'youri@saulx.com',
    bestFriend: {
      upsert: {
        email: 'jim@saulx.com',
        name: 'jim',
      },
    },
    friends: {
      upsert: [
        {
          email: 'jim@saulx.com',
          name: 'jim',
        },
      ],
    },
  })

  deepEqual(
    await db.query('user').include('friends', 'email').get().toObject(),
    [
      {
        id: 1,
        email: 'youri@saulx.com',
        friends: [
          {
            email: 'jim@saulx.com',
            id: 2,
            name: 'jim',
          },
        ],
      },
      {
        id: 2,
        email: 'jim@saulx.com',
        friends: [
          {
            email: 'youri@saulx.com',
            id: 1,
            name: 'Youri',
          },
        ],
      },
    ],
    'update 1',
  )

  deepEqual(
    await db
      .query('user')
      .filter('email', 'has', 'youri', { normalized: true })
      .get()
      .toObject(),
    [
      {
        email: 'youri@saulx.com',
        id: 1,
        name: 'Youri',
      },
    ],
    'update 2',
  )
})

await test('Get single node by alias', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'alias',
        },
      },
    },
  })

  await db.upsert('user', {
    name: 'youri',
    email: 'youri@saulx.com',
  })

  deepEqual(
    await db
      .query('user', {
        email: 'youri@saulx.com',
      })
      .get()
      .inspect()
      .toObject(),
    {
      id: 1,
      name: 'youri',
      email: 'youri@saulx.com',
    },
  )
})
