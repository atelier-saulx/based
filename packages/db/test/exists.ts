import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('exists', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          friend: {
            ref: 'user',
            prop: 'friend',
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

  const id1 = await db.create('user', {
    name: 'mr derp',
  })

  const id2 = await db.create('user', {})

  deepEqual(await db.query('user').filter('name', 'exists').get(), [
    {
      id: 1,
      name: 'mr derp',
    },
  ])

  deepEqual(await db.query('user').filter('name', '!exists').get(), [
    {
      id: 2,
      name: '',
    },
  ])

  deepEqual(await db.query('user').filter('friend', '!exists').get(), [
    {
      id: 1,
      name: 'mr derp',
    },
    {
      id: 2,
      name: '',
    },
  ])

  deepEqual(await db.query('user').filter('friends', '!exists').get(), [
    {
      id: 1,
      name: 'mr derp',
    },
    {
      id: 2,
      name: '',
    },
  ])

  await db.update('user', id1, { friends: [id2] })

  deepEqual(await db.query('user').filter('friends', 'exists').get(), [
    {
      id: 1,
      name: 'mr derp',
    },
    {
      id: 2,
      name: '',
    },
  ])

  await db.update('user', id1, { friends: null })

  deepEqual(await db.query('user').filter('friends', 'exists').get(), [])

  const friends = []
  for (let i = 0; i < 10e6; i++) {
    const id = db.create('user', {})
    friends.push(id)
  }
  await db.drain()

  await db.update('user', id1, { friends })

  deepEqual(await db.query('user').filter('friends', '!exists').get(), [
    { id: 2, name: '' },
  ])
})

await test('with other filters', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          start: 'timestamp',
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

  const id1 = await db.create('user', {
    name: 'dude',
    start: Date.now() + 10000,
  })
  const id2 = await db.create('user', {
    name: 'cool guy has friends',
    friends: [id1],
  })
  const id3 = await db.create('user', {
    name: 'sad guy has no friends',
    start: Date.now() - 10000,
  })

  deepEqual(
    await db
      .query('user')
      .include('friends')
      .filter('friends', '!exists', undefined)
      .filter('start', '>', 'now')
      .get(),
    [],
  )
})
