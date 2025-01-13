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
    friends: [bob, marie],
  })

  db.drain()

  deepEqual(
    (await db.query('user', john).include('*', 'friends').get()).toObject(),
    {
      id: 3,
      name: 'john',
      friends: [
        { id: 1, name: 'bob' },
        { id: 2, name: 'marie' },
      ],
    },
  )

  await db.update('user', john, {
    friends: {
      add: [
        {
          id: bob,
          $index: -1,
        },
      ],
    },
  })

  deepEqual(
    (await db.query('user', john).include('*', 'friends').get()).toObject(),
    {
      id: 3,
      name: 'john',
      friends: [
        { id: 2, name: 'marie' },
        { id: 1, name: 'bob' },
      ],
    },
  )

  const billy = db.create('user', {
    name: 'billy',
  })

  await db.update('user', john, {
    friends: {
      add: [
        {
          id: billy,
          $index: 0,
        },
      ],
    },
  })

  deepEqual(
    (await db.query('user', john).include('*', 'friends').get()).toObject(),
    {
      id: 3,
      name: 'john',
      friends: [
        { id: 4, name: 'billy' },
        { id: 2, name: 'marie' },
        { id: 1, name: 'bob' },
      ],
    },
  )
})
