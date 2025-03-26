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

  await db.setSchema({
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

  deepEqual(
    (
      await db.query('user', { externalId: 'i-dont-exists-haha!' }).get()
    ).toObject(),
    null,
    'Get non existing alias',
  )

  deepEqual(
    (await db.query('user', 123).get()).toObject(),
    null,
    'Get non existing id',
  )
})

await test('alias - references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
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
    name: '2',
    email: '2@saulx.com',
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
            email: '2@saulx.com',
            id: 1,
            name: '2',
          },
        ],
        id: 2,
      },
    ],
    'simple',
  )

  await db.upsert('user', {
    name: '2',
    email: '2@saulx.com',
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
        email: '2@saulx.com',
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
            email: '2@saulx.com',
            id: 1,
            name: '2',
          },
        ],
      },
    ],
    'update 1',
  )

  deepEqual(
    await db
      .query('user')
      .filter('email', 'has', '2', { lowerCase: true })
      .get()
      .toObject(),
    [
      {
        email: '2@saulx.com',
        id: 1,
        name: '2',
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

  await db.setSchema({
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
    name: '2',
    email: '2@saulx.com',
  })

  deepEqual(
    await db
      .query('user', {
        email: '2@saulx.com',
      })
      .get()
      .inspect()
      .toObject(),
    {
      id: 1,
      name: '2',
      email: '2@saulx.com',
    },
  )
})

await test('Update existing alias field', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'alias',
          status: ['login', 'clear'],
          currentToken: 'alias',
        },
      },
    },
  })

  const email = 'nuno@saulx.com'
  await db.upsert('user', {
    name: 'nuno',
    email,
    currentToken:
      // INFO: Works if this field is undefined or an empty string
      'aff1ffc48253ffe063005ecce308996da1ab01c864276faaa88bd94fab4a092d604bbd916470ff1def223bc9e8b662b7',
  })

  const existingUser = await db.query('user', { email }).get().toObject()

  let newToken =
    'e2d88cf5d303972f2eb0c381e093afb8728eaebc8114a322418403eeaf30eb767d3d7dfaef784e9c2059d6cfa78cea87'
  await db.update('user', existingUser.id, {
    currentToken: newToken,
    status: 'login',
  })
  await db.drain()

  deepEqual(
    await db
      .query('user', {
        email,
      })
      .get()
      .toObject(),
    {
      id: 1,
      name: 'nuno',
      email: 'nuno@saulx.com',
      status: 'login',
      currentToken: newToken,
    },
  )

  newToken =
    '6093127416cbc7ff8126cda605a2239a2e061a5c65a77cc38b23034441832d2c40afdaa91f83285c52edccc5dd8d18d5'
  await db.update('user', existingUser.id, {
    currentToken: newToken,
    status: 'login',
  })
  await db.drain()

  deepEqual(
    await db
      .query('user', {
        email,
      })
      .get()
      .toObject(),
    {
      id: 1,
      name: 'nuno',
      email: 'nuno@saulx.com',
      status: 'login',
      currentToken: newToken,
    },
  )

  await db.update('user', existingUser.id, {
    currentToken: null,
    status: 'clear',
  })

  await db.drain()

  deepEqual(
    await db
      .query('user', {
        email,
      })
      .get()
      .toObject(),
    {
      id: 1,
      name: 'nuno',
      email: 'nuno@saulx.com',
      status: 'clear',
      currentToken: '',
    },
  )

  newToken =
    '1e6d1b9baf291d0d3f581ca147eda5a62feba5f2e84039322d9b8e0999e5d9a8c9feae5c7707d63be670615675ad2381'
  await db.update('user', existingUser.id, {
    currentToken: newToken,
    status: 'login',
  })
  await db.drain()

  deepEqual(
    await db
      .query('user', {
        email,
      })
      .get()
      .toObject(),
    {
      id: 1,
      name: 'nuno',
      email: 'nuno@saulx.com',
      status: 'login',
      currentToken: newToken,
    },
  )
})
