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

await test('query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.putSchema({
    locales: {
      en: {},
      it: { fallback: ['en'] },
      fi: { fallback: ['en'] },
    },
    types: {
      todo: {
        done: 'boolean',
        age: 'uint16',
        unique: 'cardinality',
        status: ['a', 'b', 'c'],
        title: 'string',
        body: 'text',
      },
      user: {
        props: {
          rating: 'uint32',
          name: 'string',
          isOn: 'boolean',
          friend: { ref: 'user', prop: 'friend' },
          description: 'text',
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

  await db.create('user', { name: 'power user' })

  await throws(() => db.query('derp').get(), true, 'non existing type')

  // @ts-ignore
  await throws(() => db.query('user', 'derp derp').get(), true, 'incorrect id')

  await throws(
    () => db.query('user', [1, 1221.11, 0]).get(),
    true,
    'incorrect ids',
  )

  await throws(
    // @ts-ignore
    () => db.query('user', [1, 'X', {}]).get(),
    true,
    'incorrect ids 2',
  )

  const x = new Uint32Array(new Array(2e6).map((v) => 1))
  await throws(() => db.query('user', x).get(), true, 'incorrect ids 2')

  await throws(
    () => db.query('user').include('derp').get(),
    true,
    'non existing field in include',
  )

  await throws(
    // @ts-ignore
    () => db.query('user', { $id: 1 }).get(),
    true,
    'incorrect alias',
  )

  await throws(
    () => db.query('user').filter('derp', '=', true).get(),
    true,
    'non existing field in filter',
  )

  await db
    .query('user')
    .filter('friend.description.en', '=', 'nice')
    .get()
    .catch((err) => {
      console.error(err)
    })

  await throws(
    () => db.query('user').filter('friend.description.flap', '=', 'nice').get(),
    true,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').filter('friend.description.flap', '=', 'nice').get(),
    true,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').filter('friend.description.fr', '=', 'nice').get(),
    true,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').include('friend.description.flap').get(),
    true,
    'non existing lang in include #1',
  )

  await throws(
    () => db.query('user').include('friend.description.fr').get(),
    true,
    'non existing lang in include #2',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend.description.fr', 'derp', 1).get(),
    true,
    'Filter non existing operator',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend.description.en', '>', 1).get(),
    true,
    'Filter incorrect operator on text',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('rating', 'has', 1).get(),
    true,
    'Filter incorrect operator on uint32',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('isOn', 'has', 1).get(),
    true,
    'Filter incorrect operator on bool',
  )

  await db.query('user').filter('isOn', true).get()
  await db.query('user').filter('isOn').get()
  await db.query('user').filter('isOn', false).get()

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend', 'has', 1).get(),
    true,
    'Filter incorrect operator on reference',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('connections', 'like', 1).get(),
    true,
    'Filter incorrect operator on references',
  )

  deepEqual(
    await db
      .query('user')
      .filter('name', 'has', '')
      .include('name')
      .get()
      .inspect()
      .toObject(),
    [
      {
        name: 'power user',
        id: 1,
      },
    ],
  )

  deepEqual(
    await db
      .query('user')
      .filter('friend.description.en', '=', undefined)
      .include('name')
      .get()
      .inspect()
      .toObject(),
    [
      {
        name: 'power user',
        id: 1,
      },
    ],
  )
})
