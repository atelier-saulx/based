import { BasedDb } from '../src/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.putSchema({
    types: {
      user: {
        props: {
          rating: 'uint32',
          name: 'string',
          friend: { ref: 'user', prop: 'friend' },
          countryCode: { type: 'string', maxBytes: 2 },
          connections: {
            items: {
              ref: 'user',
              prop: 'connections',
            },
          },
        },
      },
    },
  })

  const good = await db.create('user', {
    name: 'youzi',
  })

  const bad = db.create('user', {
    name: 1,
  })

  db.create('user', {
    name: 'jamex',
    friend: bad,
  })

  db.create('user', {
    name: 'fred',
    connections: [good, bad],
  })

  db.create('user', {
    name: 'wrongRating',
    rating: 'not a number',
  })

  await db.create('user', {
    name: 'jame-z',
    friend: good,
    connections: [good],
  })

  db.create('user', {
    name: 'fred',
    connections: [good, bad],
  })

  db.create('user', {
    name: 'wrongRating',
    rating: 'not a number',
  })

  await throws(() =>
    db.create('user', {
      name: 'nope',
      randomField: true,
    }),
  )

  await throws(
    () =>
      db.create('user', {
        countryCode: 'nope',
      }),
    true,
  )

  await db.drain()

  deepEqual(
    (await db.query('user').include('name', 'friend').get()).toObject(),
    [
      {
        id: 1,
        name: 'youzi',
        friend: {
          id: 2,
          rating: 0,
          countryCode: '',
          name: 'jame-z',
        },
      },
      {
        id: 2,
        name: 'jame-z',
        friend: {
          id: 1,
          rating: 0,
          countryCode: '',
          name: 'youzi',
        },
      },
    ],
  )
})
