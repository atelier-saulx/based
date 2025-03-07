import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('exists', async (t) => {
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

  await db.query('user').get().inspect(10)

  deepEqual(await db.query('user').filter('name', 'exists').get().toObject(), [
    {
      id: 1,
      name: 'mr derp',
    },
  ])

  deepEqual(await db.query('user').filter('name', '!exists').get().toObject(), [
    {
      id: 2,
      name: '',
    },
  ])

  deepEqual(
    await db.query('user').filter('friend', '!exists').get().toObject(),
    [
      {
        id: 1,
        name: 'mr derp',
      },
      {
        id: 2,
        name: '',
      },
    ],
  )

  deepEqual(
    await db.query('user').filter('friends', '!exists').get().toObject(),
    [
      {
        id: 1,
        name: 'mr derp',
      },
      {
        id: 2,
        name: '',
      },
    ],
  )

  await db.update('user', id1, { friends: [id2] })

  deepEqual(
    await db.query('user').filter('friends', 'exists').get().toObject(),
    [
      {
        id: 1,
        name: 'mr derp',
      },
      {
        id: 2,
        name: '',
      },
    ],
  )

  await db.update('user', id1, { friends: null })

  deepEqual(
    await db.query('user').filter('friends', 'exists').get().toObject(),
    [],
  )
})
