import { BasedDb } from '../src/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    locales: { en: {}, de: {} },
    types: {
      flap: {
        x: {
          ref: 'user',
          prop: 'y',
        },
      },
      user: {
        props: {
          name: 'string',
          connections: {
            items: {
              ref: 'user',
              prop: 'connections',
            },
          },
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
              $bestFriend: 'boolean',
              $friendShipBadge: 'binary',
              $friendsSince: 'timestamp',
            },
          },
        },
      },
    },
  })

  await throws(async () => {
    return db.query('flap').include('x.$derp').get()
  }, 'Non existing reference on flap')

  const user1 = await db.create('user', { name: 'user1' })
  const user2 = await db.create('user', { name: 'user2' })
  const user3 = await db.create('user', { name: 'user3' })
  const invalidId = 'usr_invalid'

  const userWithConn = await db.create('user', {
    name: 'connectedUser',
    connections: [user1, user2],
  })

  await db.update('user', userWithConn, {
    connections: { add: [user3] },
  })

  await db.update('user', userWithConn, {
    connections: { add: [user1] },
  })

  await db.update('user', userWithConn, {
    connections: { delete: [user3] },
  })

  deepEqual(
    await db
      .query('user', userWithConn)
      .include('name', 'connections.id')
      .get(),
    {
      id: userWithConn,
      name: 'connectedUser',
      connections: [{ id: user1 }, { id: user2 }],
    },
    'Connections after valid ops',
  )

  await throws(async () => {
    db.create('user', { connections: user1 })
  }, 'Expected array for references field connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: user1 })
  }, 'Expected array or object for references field connections')

  await throws(async () => {
    db.create('user', { connections: [user1, 'not an id'] })
  }, 'Invalid reference "not an id" for field connections')

  await throws(async () => {
    db.create('user', { connections: [user1, {}] })
  }, 'Invalid reference "[object Object]" for field connections')

  await throws(async () => {
    db.create('user', { connections: [user1, invalidId] })
  }, 'Invalid reference "usr_invalid" for field connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: { add: [invalidId] } })
  }, 'Invalid reference "usr_invalid" for field add in connections')

  await throws(async () => {
    db.update('user', userWithConn, {
      connections: { update: [invalidId] },
    })
  }, 'Invalid reference "usr_invalid" for field update in connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: { add: [invalidId] } })
  }, 'Invalid reference "usr_invalid" for field add in connections')

  await throws(async () => {
    db.update('user', userWithConn, {
      connections: { delete: [invalidId] },
    })
  }, 'Invalid reference "usr_invalid" for field delete in connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: { update: 'bla' } })
  }, 'Expected array for field set in connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: { add: {} } })
  }, 'Expected array for field add in connections')

  await throws(async () => {
    db.update('user', userWithConn, { connections: { delete: 123 } })
  }, 'Expected array for field delete in connections')

  // --- Friends (with Edges) Validation ---
  const now = Date.now()
  const badge = new Uint8Array([1, 2, 3])
  const badgeString = 'badge-string' // String is also valid for binary

  const userWithFriends = await db.create('user', {
    name: 'friendlyUser',
    friends: [
      {
        id: user1,
        $bestFriend: true,
        $friendsSince: now,
        $friendShipBadge: badge,
      },
      { id: user2, $bestFriend: false, $friendShipBadge: badgeString }, // Minimal edge data + string badge
    ],
  })

  await db.update('user', userWithFriends, {
    friends: {
      update: [
        { id: user3, $bestFriend: true, $friendsSince: '09/02/2000' },
        user1, // Can mix objects and IDs
      ],
    },
  })

  await db.update('user', userWithFriends, {
    friends: { add: [{ id: user3, $bestFriend: true }] },
  })

  await db.update('user', userWithFriends, {
    friends: { delete: [user1] },
  })

  deepEqual(
    await db.query('user', userWithFriends).include('name', 'friends').get(),
    {
      id: 5,
      name: 'friendlyUser',
      friends: [
        {
          id: 2,
          name: 'user2',
        },
        {
          id: 3,
          name: 'user3',
        },
      ],
    },
    'Friends references after valid ops',
  )

  deepEqual(
    await db
      .query('user', userWithFriends)
      .include(
        'name',
        'friends.$bestFriend',
        'friends.$friendsSince',
        'friends.$friendShipBadge',
      )
      .get(),
    {
      id: 5,
      name: 'friendlyUser',
      friends: [
        {
          id: 2,
          $bestFriend: false,
          $friendsSince: 0,
          $friendShipBadge: new Uint8Array([
            98, 97, 100, 103, 101, 45, 115, 116, 114, 105, 110, 103,
          ]),
        },
        {
          id: 3,
          $bestFriend: true,
          $friendsSince: new Date('09/02/2000').getTime(),
        },
      ],
    },
    'Friends edge data after valid ops',
  )

  const newTimestamp = Date.now() + 10000

  await db.update('user', userWithFriends, {
    friends: {
      update: [
        { id: user2, $bestFriend: true, $friendsSince: newTimestamp },
        { id: user3, $friendShipBadge: new Uint8Array([4, 5, 6]) },
      ],
    },
  })

  deepEqual(
    await db
      .query('user', userWithFriends)
      .include(
        'name',
        'friends.$bestFriend',
        'friends.$friendsSince',
        'friends.$friendShipBadge',
      )
      .get(),
    {
      id: 5,
      name: 'friendlyUser',
      friends: [
        {
          id: 2,
          $bestFriend: true,
          $friendsSince: newTimestamp,
          $friendShipBadge: new Uint8Array([
            98, 97, 100, 103, 101, 45, 115, 116, 114, 105, 110, 103,
          ]),
        },
        {
          id: 3,
          $bestFriend: true,
          $friendsSince: new Date('09/02/2000').getTime(),
          $friendShipBadge: new Uint8Array([4, 5, 6]),
        },
      ],
    },
    'Friends edge data after update operation',
  )

  await throws(async () => {
    db.create('user', { friends: { id: user1 } })
  }, 'Expected array for references field friends')

  await throws(async () => {
    db.update('user', userWithFriends, { friends: user1 })
  }, 'Expected array or object for references field friends')

  await throws(async () => {
    db.create('user', { friends: [user1, 'not an id'] })
  }, 'Invalid reference "not an id" for field friends')

  await throws(async () => {
    db.create('user', { friends: [user1, { $bestFriend: true }] })
  }, 'Missing id in reference object for field friends')

  await throws(async () => {
    db.create('user', { friends: [user1, { id: invalidId }] })
  }, 'Invalid reference "usr_invalid" for field friends')

  await throws(async () => {
    db.create('user', {
      friends: [{ id: user1, $bestFriend: 'yes' }],
    })
  }, 'Incorrect type for $bestFriend expected boolean got string')

  await throws(async () => {
    db.create('user', {
      friends: [{ id: user1, $friendsSince: 'yesterday maybe?' }],
    })
  }, 'Incorrect type for $friendsSince expected timestamp got string')

  await throws(async () => {
    db.create('user', {
      friends: [{ id: user1, $friendShipBadge: [1, 2, 3] }],
    })
  }, 'Incorrect type for $friendShipBadge expected binary got array')

  await throws(async () => {
    db.create('user', {
      friends: [{ id: user1, $friendLevel: 9000 }],
    })
  }, 'Unknown edge field "$friendLevel" for reference field friends')

  await throws(async () => {
    db.update('user', userWithFriends, {
      friends: { add: [{ id: user1, $bestFriend: 'yes' }] },
    })
  }, 'Incorrect type for $bestFriend expected boolean got string')

  await throws(async () => {
    db.update('user', userWithFriends, {
      friends: { add: [{ $bestFriend: true }] },
    })
  }, 'Missing id in reference object for field add in friends')

  await throws(async () => {
    db.update('user', userWithFriends, {
      friends: { delete: [{ id: user1 }] },
    })
  }, 'Cannot have edge data in delete operation for field friends')

  await throws(async () => {
    db.update('user', userWithFriends, { friends: { add: {} } })
  }, 'Expected array for field add in friends')

  await throws(async () => {
    db.update('user', userWithFriends, { friends: { delete: 123 } })
  }, 'Expected array for field delete in friends')

  await throws(async () =>
    db.update('user', userWithConn, {
      connections: { add: [userWithConn] },
    })
  )
})
