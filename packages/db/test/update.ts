import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

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

  db.updateSchema({
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

  db.drain()

  deepEqual(db.query('snurp').get().toObject(), [
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

  db.drain()

  db.update('snurp', snurp2, {
    name: 'mr snurp 2!',
    nested: {
      derp: 'b',
    },
  })

  db.drain()

  deepEqual(db.query('snurp').get().toObject(), [
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

  db.drain()

  deepEqual(db.query('snurp', 2).get().toObject(), {
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
  deepEqual(db.query('snurp', [2, 1]).get().toObject(), [
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
  for (let i = 1; i <= 1e6; i++) {
    ids.push(i)
    db.create('snurp', {
      a: i,
      name: 'mr snurp ' + i,
      nested: {
        derp: 'b',
      },
    })
  }

  db.drain()

  equal(db.query('snurp', ids).get().length, 1e6)

  equal(db.query('snurp', ids).range(0, 100).get().length, 100)

  equal(db.query('snurp', ids).range(10, 100).get().length, 90)

  let total = 0
  let len = 0
  for (var j = 0; j < 1; j++) {
    let x = 0
    const d = Date.now()
    for (var i = 0; i < 1e5; i++) {
      x += db.query('snurp', i).include('a').get().execTime
    }
    total += x
    len++
  }

  equal(
    total / len < 1e3,
    true,
    'Is at least faster then 1 second for 100k seperate updates and query',
  )
})
