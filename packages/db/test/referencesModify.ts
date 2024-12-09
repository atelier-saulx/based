import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('references modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
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

  const bob = db.create('user', {
    name: 'bob',
  })
  db.drain()

  const marie = db.create('user', {
    name: 'marie',
  })
  db.drain()

  const john = db.create('user', {
    name: 'john',
    friends: [bob],
  })
  db.drain()

  await db.update('user', john, {
    friends: {
      delete: [bob],
      add: [marie],
    },
  })
  db.drain()

  deepEqual(
    (await db.query('user').include('*', 'friends').get()).toObject(),
    [
      { id: 1, name: 'bob', friends: [] },
      { id: 2, name: 'marie', friends: [{ id: 3, name: 'john' }] },
      { id: 3, name: 'john', friends: [{ id: 2, name: 'marie' }] },
    ],
    'add/delete',
  )

  await db.update('user', john, {
    friends: {
      add: [bob],
    },
  })

  db.drain()

  deepEqual(
    (await db.query('user').include('*', 'friends').get()).toObject(),
    [
      { id: 1, name: 'bob', friends: [{ id: 3, name: 'john' }] },
      { id: 2, name: 'marie', friends: [{ id: 3, name: 'john' }] },
      {
        id: 3,
        name: 'john',
        friends: [
          { id: 2, name: 'marie' },
          { id: 1, name: 'bob' },
        ],
      },
    ],
    'add',
  )

  await db.update('user', john, {
    friends: null,
  })

  deepEqual(
    (await db.query('user').include('*', 'friends').get()).toObject(),
    [
      { id: 1, name: 'bob', friends: [] },
      { id: 2, name: 'marie', friends: [] },
      { id: 3, name: 'john', friends: [] },
    ],
    'delete',
  )

  await db.update('user', john, {
    friends: [1, 2],
  })

  console.log(
    '----',
    (await db.query('user').include('*', 'friends').get()).toObject(),
  )

  await db.update('user', john, {
    friends: [1],
  })

  console.log(
    '----',
    (await db.query('user').include('*', 'friends').get()).toObject(),
  )
})
