import test from './shared/test.js'
import { deepEqual, equal, throws } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test('update with payload.id', async (t) => {
  const db = await testDb(t, {
    types: {
      article: {
        body: 'string',
      },
    },
  })

  const article1 = await db.create('article', {})
  await db.update('article', article1, {
    body: 'xxx',
  })

  deepEqual(await db.query('article').get(), [
    {
      id: 1,
      body: 'xxx',
    },
  ])
})

await test('update', async (t) => {
  const db = await testDb(t, {
    types: {
      mep: {
        props: {
          a: { type: 'uint32' },
          countryCode: { type: 'string', maxBytes: 10 },
          b: { type: 'uint32' },
          c: { type: 'uint32' },
        },
      },
      snurp: {
        props: {
          a: { type: 'uint32' },
          countryCode: { type: 'string', maxBytes: 2 },
          b: { type: 'uint32' },
          c: { type: 'uint32' },
          name: { type: 'string' },
          email: { type: 'string' },
          nested: {
            type: 'object',
            props: {
              derp: { type: 'string', maxBytes: 1 },
            },
          },
        },
      },
    },
  })

  const snurp = db.create('snurp', {
    name: 'mr snurp',
    email: 'snurp@snurp.snurp',
    a: 1,
    b: 2,
    c: 3,
    countryCode: 'NL',
  })

  const snurp2 = db.create('snurp', {
    name: 'mr snurp 2',
  })

  await db.drain()

  deepEqual(await db.query('snurp').get(), [
    {
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      id: 1,
      name: 'mr snurp',
      nested: {
        derp: '',
      },
    },
    {
      a: 0,
      b: 0,
      c: 0,
      email: '',
      countryCode: '',
      id: 2,
      name: 'mr snurp 2',
      nested: {
        derp: '',
      },
    },
  ])

  db.update('snurp', snurp, {
    name: 'mr snurp!',
    nested: {
      derp: 'a',
    },
  })

  await db.drain()

  db.update('snurp', snurp2, {
    name: 'mr snurp 2!',
    nested: {
      derp: 'b',
    },
  })

  await db.drain()

  deepEqual(await db.query('snurp').get(), [
    {
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      id: 1,
      name: 'mr snurp!',
      nested: {
        derp: 'a',
      },
    },
    {
      a: 0,
      b: 0,
      c: 0,
      countryCode: '',
      email: '',
      id: 2,
      name: 'mr snurp 2!',
      nested: {
        derp: 'b',
      },
    },
  ])

  await db.drain()

  deepEqual(await db.query('snurp', 2).get(), {
    a: 0,
    b: 0,
    c: 0,
    countryCode: '',
    email: '',
    id: 2,
    name: 'mr snurp 2!',
    nested: {
      derp: 'b',
    },
  })

  // for individual queries combine them
  deepEqual(await db.query('snurp', [2, 1]).get(), [
    {
      id: 2,
      a: 0,
      b: 0,
      c: 0,
      countryCode: '',
      email: '',
      name: 'mr snurp 2!',
      nested: {
        derp: 'b',
      },
    },
    {
      id: 1,
      a: 1,
      b: 2,
      c: 3,
      countryCode: 'NL',
      email: 'snurp@snurp.snurp',
      name: 'mr snurp!',
      nested: {
        derp: 'a',
      },
    },
  ])

  const ids: number[] = []
  let snurpId = 1
  for (; snurpId <= 1e6; snurpId++) {
    ids.push(snurpId)
    db.create('snurp', {
      a: snurpId,
      name: 'mr snurp ' + snurpId,
      nested: {
        derp: 'b',
      },
    })
  }

  await db.drain()

  equal((await db.query('snurp', ids).get())?.length, 1e3)

  equal((await db.query('snurp', ids).range(0, 100).get()).length, 100)

  equal((await db.query('snurp', ids).range(10, 110).get()).length, 100)

  deepEqual(
    await db
      .query('snurp', ids)
      .range(1e5, 1e5 + 2)
      .sort('a', 'desc')
      .get(),
    [
      {
        id: 900000,
        a: 899998,
        countryCode: '',
        b: 0,
        c: 0,
        nested: { derp: 'b' },
        name: 'mr snurp 899998',
        email: '',
      },
      {
        id: 899999,
        a: 899997,
        countryCode: '',
        b: 0,
        c: 0,
        nested: { derp: 'b' },
        name: 'mr snurp 899997',
        email: '',
      },
    ],
  )

  const promises: any[] = []
  for (var j = 0; j < 1; j++) {
    for (var i = 0; i < 1e5; i++) {
      promises.push(db.query('snurp', i).include('a').get())
    }
  }

  const res = await Promise.all(promises)
  const total = res.reduce((n, { execTime }) => n + execTime, 0)

  equal(
    total / res.length < 1e3,
    true,
    'Is at least faster then 1 second for 100k separate updates and query',
  )

  const nonExistingId = snurpId + 10

  throws(() =>
    db.update('snurp', nonExistingId, {
      a: nonExistingId,
      name: 'mr snurp ' + nonExistingId,
    }),
  )
})
