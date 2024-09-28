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

  const marie = db.create('user', {
    name: 'marie',
  })

  const john = db.create('user', {
    name: 'john',
    friends: [bob],
  })

  await db.update('user', john, {
    friends: {
      delete: [bob],
      add: [marie],
    },
  })

  deepEqual(
    db.query('user').include('*', 'friends').get().toObject(),
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

  deepEqual(
    db.query('user').include('*', 'friends').get().toObject(),
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
    db.query('user').include('*', 'friends').get().toObject(),
    [
      { id: 1, name: 'bob', friends: [] },
      { id: 2, name: 'marie', friends: [] },
      { id: 3, name: 'john', friends: [] },
    ],
    'delete',
  )

  /*
  await db.update('user', john, {
    friends: {
      update: [
        {
          id: bob,
          $index: 0,
        },
      ],
    },
  })

  deepEqual(
    db.query('user').include('*', 'friends').get().toObject(),
    [
      { id: 1, name: 'bob', friends: [{ id: 3, name: 'john' }] },
      { id: 2, name: 'marie', friends: [{ id: 3, name: 'john' }] },
      {
        id: 3,
        name: 'john',
        friends: [
          { id: 1, name: 'bob' },
          { id: 2, name: 'marie' },
        ],
      },
    ],
    'update index',
  )
  */

  // console.dir(db.query('user').include('friends').get().toObject(), {
  //   depth: null,
  // })

  // deepEqual(
  //   db.query('user').include('friends').get().toObject(),
  //   {
  //     id: 1,
  //     contributors: [
  //       { id: 4, name: 'Dinkel Doink', flap: 40 },
  //       { id: 3, name: 'Derpie', flap: 30 },
  //     ],
  //   },
  //   'Filter references and sort',
  // )

  // db.update('user', john, {
  //   friends: {
  //     delete: bob,
  //     add: [{
  //       id: marie,
  //       $index: 1,
  //     }],
  //   },
  // })

  // console.log({ a, b })
})
