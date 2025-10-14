import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('references modify', async (t) => {
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
  await db.drain()

  const marie = db.create('user', {
    name: 'marie',
  })
  await db.drain()

  const john = db.create('user', {
    name: 'john',
    friends: [bob],
  })
  await db.drain()

  await db.update('user', john, {
    friends: {
      delete: [bob],
      update: [marie],
    },
  })

  await db.drain()

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
      update: [bob],
    },
  })

  await db.drain()

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
})

await test('references modify 2', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      a: {
        name: 'string',
        bees: {
          items: {
            ref: 'b',
            prop: 'as',
            // $power: 'uint8',
          },
        },
      },
      b: {
        name: 'string',
        as: {
          items: {
            ref: 'a',
            prop: 'bees',
            $power: 'uint8',
          },
        },
      },
    },
  })

  const a = await db.create('a', {})
  const b = await db.create('b', {
    as: [
      {
        id: a,
        $power: 1,
      },
    ],
  })

  await db.update('b', b, {
    as: null,
  })
})

await test('reference move', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      a: {
        name: 'string',
        bees: {
          items: {
            ref: 'b',
            prop: 'as',
          },
        },
      },
      b: {
        name: 'string',
        as: {
          items: {
            ref: 'a',
            prop: 'bees',
          },
        },
      },
    },
  })

  const a = await db.create('a', {})
  const b1 = await db.create('b', {
    as: [
      {
        id: a,
      },
    ],
  })
  const b2 = await db.create('b', {
    as: [
      {
        id: a,
      },
    ],
  })

  await db.update('a', a, {
    bees: [b1],
  })
  await db.update('a', a, {
    bees: [b2],
  })

  deepEqual(
    (await db.query('a').include('bees').get()).toObject()[0].bees[0].id,
    2,
  )

  await db.update('a', a, {
    bees: [b2, b2],
  })
  deepEqual(
    (await db.query('a').include('bees').get()).toObject()[0].bees.length,
    1,
  )
  deepEqual(
    (await db.query('a').include('bees').get()).toObject()[0].bees[0].id,
    2,
  )
})

// https://linear.app/1ce/issue/FDN-1735

await test('try to modify undefined refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      movie: {
        name: 'string',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'actor',
          },
        },
      },
      actor: {
        name: 'string',
        movies: {
          items: {
            ref: 'movie',
            prop: 'movie',
          },
        },
      },
    },
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    genre: 'Crime',
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    genre: 'Crime',
  })
  const a1 = db.create('actor', { name: 'Uma Thurman', movies: [m1, m2] })
  const a2 = db.create('actor', { name: 'Jonh Travolta', movies: [m2] })

  db.query('movie').include('*').get().inspect()

  await db.update('movie', m1, {
    actors: { delete: [a1] },
  })
})
