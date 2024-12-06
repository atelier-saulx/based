import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  db.putSchema({
    types: {
      user: {
        props: {
          rating: 'uint32',
          name: 'string',
          friend: { ref: 'user', prop: 'friend' },
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

  const a = await db.create('user', {
    name: 'jame-z',
    friend: good,
    connections: [good],
  })

  db.create('user', {
    name: 'nope',
    randomField: true,
  })
    .catch((e) => {
      console.log('its wrong!!', e)
      return 'commando power'
    })
    .then((res) => {
      console.log('floops!', { res })
    })

  db.drain()

  deepEqual(
    (await db.query('user').include('name', 'friend').get()).toObject(),
    [
      {
        id: 1,
        name: 'youzi',
        friend: {
          id: 6,
          rating: 0,
          name: 'jame-z',
        },
      },
      {
        id: 6,
        name: 'jame-z',
        friend: {
          id: 1,
          rating: 0,
          name: 'youzi',
        },
      },
    ],
  )
})
