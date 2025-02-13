import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { setTimeout } from 'node:timers/promises'

await test('references modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
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
      set: [marie],
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
      set: [bob],
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

await test('references modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
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
