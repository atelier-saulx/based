import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('update with payload.id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      article: {
        body: 'string',
      },
    },
  })

  const article1 = await db.create('article')
  await db.update('article', {
    id: article1,
    body: 'xxx',
  })

  deepEqual(await db.query('article').get().toObject(), [
    {
      id: 1,
      body: 'xxx',
    },
  ])
})

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  /*
    float32	JSON numbers	3.14
    float64	JSON numbers	3.14
    int8	Whole JSON numbers that fit in a signed 8-bit integer	127
    uint8	Whole JSON numbers that fit in an unsigned 8-bit integer	255
    int16	Whole JSON numbers that fit in a signed 16-bit integer	32767
    uint16	Whole JSON numbers that fit in an unsigned 16-bit integer	65535
    int32	Whole JSON numbers that fit in a signed 32-bit integer	2147483647
    uint32	Whole JSON numbers that fit in an unsigned 32-bit integer
  */

  await db.putSchema({
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

  deepEqual((await db.query('snurp').get()).toObject(), [
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

  deepEqual((await db.query('snurp').get()).toObject(), [
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

  deepEqual((await db.query('snurp', 2).get()).toObject(), {
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
  deepEqual((await db.query('snurp', [2, 1]).get()).toObject(), [
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

  // ------------------------------
  const ids = []
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

  equal((await db.query('snurp', ids).get()).length, 1e6)

  equal((await db.query('snurp', ids).range(0, 100).get()).length, 100)

  equal((await db.query('snurp', ids).range(10, 100).get()).length, 100)

  deepEqual(
    (
      await db.query('snurp', ids).range(1e5, 2).sort('a', 'desc').get()
    ).toObject(),
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

  const promises = []
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

  // should throw!
  const r = await db.update('snurp', nonExistingId, {
    a: nonExistingId,
    name: 'mr snurp ' + nonExistingId,
  })
})
