import { BasedDb } from '../../src/index.js'
import { deepEqual, throws } from '../shared/assert.js'
import test from '../shared/test.js'

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    locales: { en: {}, de: {} },
    types: {
      user: {
        props: {
          json: 'json',
          bool: 'boolean',
          u32: 'uint32',
          u8: 'uint8',
          i8: 'int8',
          i32: 'int32',
          u16: 'uint16',
          i16: 'int16',
          name: 'string',
          number: 'number',
          binaryData: 'binary',
          date: 'timestamp',
          numberMax: { type: 'number', max: 20, min: 10 },
          derp: ['a', 'b', 'derp'],
          cardinality: 'cardinality',
          text: 'text',
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

  db.create('user', {
    text: {
      en: 'xxx',
    },
  })

  await throws(async () => {
    db.create('user', {
      text: {
        en: 123,
      },
    })
  })

  await throws(async () => {
    db.create(
      'user',
      {
        text: 123,
      },
      { locale: 'en' },
    )
  })

  await throws(async () => {
    db.create('user', {
      text: { xh: 'hello!' },
    })
  })

  await throws(async () => {
    db.create(
      'user',
      {
        text: 'hello!',
      },
      { locale: 'xh' },
    )
  })

  await throws(async () => {
    db.create('user', {
      name: 1,
    })
  })

  await throws(async () => {
    await db.create('user', { date: {} })
  })

  await throws(async () => {
    await db.create('user', { date: -10 })
  })

  await throws(async () => {
    await db.create('user', { json: function () {} })
  })

  await throws(async () => {
    await db.create('user', { on: 255 + 1 })
  })

  await throws(async () => {
    db.create('user', {
      number: 'nla',
    })
  })

  await throws(async () => {
    db.create('user', {
      numberMax: 21,
    })
  })

  await throws(async () => {
    db.create('user', {
      countryCode: 'nla',
    })
  })

  await throws(async () => {
    db.create('user', {
      derp: [1, 2, 3, 4],
    })
  })

  db.create('user', {
    derp: 'a',
  })

  db.create('user', {
    derp: undefined,
  })

  const cId = db.create('user', {
    cardinality: 'derp',
  })

  db.update('user', cId, {
    cardinality: ['derp2'],
  })

  await throws(async () => {
    db.update('user', cId, {
      cardinality: ['a', 'b', 1],
    })
  })

  deepEqual(await db.query('user', cId).include('cardinality').get(), {
    id: cId.tmpId,
    cardinality: 2,
  })

  await throws(async () => {
    db.create('user', {
      cardinality: [1, 2, 3, 4],
    })
  })

  await throws(async () => {
    db.create('user', {
      cardinality: { id: [1, 2, 3, 4] },
    })
  })

  await throws(async () => {
    db.create('user', {
      friend: { id: undefined },
    })
  })

  const good = await db.create('user', {
    name: 'youzi',
  })

  const bad = 'xxx'

  await throws(async () => {
    db.create('user', {
      name: 1,
    })
  })

  await throws(async () => {
    db.create('user', {
      name: 'jamex',
      friend: bad,
    })
  })

  await throws(async () => {
    db.create('user', {
      name: 'fred',
      connections: [good, bad],
    })
  })

  await throws(async () => {
    db.create('user', {
      name: 'wrongRating',
      u32: 'not a number',
    })
  })

  var cnt = 0

  await throws(
    async () => {
      db.create('user', {
        name: 'wrongRating',
        u32: 'not a number',
      }).catch((err) => {
        cnt++
      })
    },
    false,
    'edge case CATCH does not work with the system',
  )

  await db.create('user', {
    name: 'jame-z',
    friend: good,
    connections: [good],
  })

  await throws(async () => {
    db.create('user', {
      name: 'fred',
      connections: [good, bad],
    })
  })

  await throws(async () => {
    db.create('user', {
      name: 'wrongRating',
      u32: 'not a number',
    })
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
    false,
    'Test OK: Correctly throws!',
  )

  await db.drain()

  deepEqual(
    await db.query('user').include('name', 'friend').get(),
    [
      { id: 1, friend: null, name: '' },
      { id: 2, friend: null, name: '' },
      { id: 3, friend: null, name: '' },
      { id: 4, friend: null, name: '' },
      {
        id: 5,
        name: 'youzi',
        friend: {
          id: 6,
          bool: false,
          u32: 0,
          u8: 0,
          i8: 0,
          i32: 0,
          u16: 0,
          i16: 0,
          number: 0,
          date: 0,
          numberMax: 0,
          derp: undefined,
          countryCode: '',
          name: 'jame-z',
          json: null,
          cardinality: 0,
          text: { en: '', de: '' },
          binaryData: new Uint8Array([]),
        },
      },
      {
        id: 6,
        name: 'jame-z',
        friend: {
          id: 5,
          bool: false,
          u32: 0,
          u8: 0,
          i8: 0,
          i32: 0,
          u16: 0,
          i16: 0,
          number: 0,
          date: 0,
          numberMax: 0,
          derp: undefined,
          countryCode: '',
          name: 'youzi',
          json: null,
          cardinality: 0,
          text: { en: '', de: '' },
          binaryData: new Uint8Array([]),
        },
      },
    ],
    'get all',
  )

  await throws(async () => {
    db.create('user', {
      connections: {
        set: [],
      },
    })
  }, 'Invalid key')

  await throws(async () => {
    db.create('user', {
      connections: 1,
    })
  })

  await throws(async () => {
    db.create('user', {
      connections: {
        add: ['x'],
      },
    })
  })

  const id = await db.create('user', undefined)

  await throws(
    async () => {
      await db.create('user', { u8: 255 + 1 })
    },
    false,
    'Out of bounds value should throw (u8)',
  )

  await throws(
    async () => {
      await db.create('user', { i8: 127 + 1 })
    },
    false,
    'Out of bounds value should throw (i8)',
  )

  await throws(
    async () => {
      await db.create('user', { u16: 65535 + 1 })
    },
    false,
    'Out of bounds value should throw (u16)',
  )

  await throws(
    async () => {
      await db.create('user', { u32: 4294967295 + 1 })
    },
    false,
    'Out of bounds value should throw (u32)',
  )

  await throws(
    async () => {
      await db.create('user', { i32: 2147483647 + 1 })
    },
    false,
    'Out of bounds value should throw (i32)',
  )

  await throws(
    async () => {
      await db.create('user', { i16: 32767 + 1 })
    },
    false,
    'Out of bounds value should throw (i16)',
  )

  await throws(
    async () => {
      await db.create('user', { u8: -10 })
    },
    false,
    'Negative value should throw (u8)',
  )

  await throws(
    async () => {
      await db.create('user', { u16: -10 })
    },
    false,
    'Negative value should throw (u16)',
  )

  await throws(
    async () => {
      await db.create('user', { u32: -10 })
    },
    false,
    'Negative value should throw (u32)',
  )

  await throws(
    async () => {
      await db.create('user', { i32: -(2147483648 + 1) })
    },
    false,
    'Too small out of bounds value should throw (int32)',
  )

  await throws(
    async () => {
      await db.create('user', { i16: -(32768 + 1) })
    },
    false,
    'Too small out of bounds value should throw (int16)',
  )

  await throws(
    async () => {
      await db.create('user', { i8: -(128 + 1) })
    },
    false,
    'Too small out of bounds value should throw (int8)',
  )

  db.create('user', {
    binaryData: 'not a binary',
  })

  await throws(async () => {
    db.create('user', {
      binaryData: 12345,
    })
  })

  await throws(async () => {
    db.create('user', {
      binaryData: { some: 'object' },
    })
  })

  await throws(async () => {
    db.create('user', {
      binaryData: [1, 2, 3, 4],
    })
  })

  db.create('user', {
    binaryData: new Uint8Array([1, 2, 3, 4]),
  })
})

await test('query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  const drip = ['dope', 'cringe', 'meh']

  await db.setSchema({
    locales: {
      en: {},
      it: { fallback: 'en' },
      fi: { fallback: 'en' },
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
          drip,
          friend: { ref: 'user', prop: 'friend' },
          description: 'text',
          countryCode: { type: 'string', maxBytes: 2 },
          blap: { type: 'vector', size: 5, baseType: 'float32' },
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

  for (let i = 0; i < 5; i++) {
    await db.create('user', {
      name: 'power user ' + i,
      rating: i,
      isOn: i % 2 ? true : false,
      drip: drip[~~(Math.random() * drip.length)],
    })
    await db.create('user')
  }

  await throws(
    // @ts-ignore
    () => db.query('user', '1').get(),
    false,
    'throw on string as id',
  )

  await throws(() => db.query('derp').get(), false, 'non existing type')

  // @ts-ignore
  await throws(() => db.query('user', 'derp derp').get(), false, 'incorrect id')

  await throws(
    () => db.query('user', [1, 1221.11, 0]).get(),
    false,
    'incorrect ids',
  )

  await throws(
    // @ts-ignore
    () => db.query('user', [1, 'X', {}]).get(),
    false,
    'incorrect ids 2',
  )

  const x = new Uint32Array(new Array(2e6).map((v) => 1))
  await throws(() => db.query('user', x).get(), false, 'incorrect ids 2')

  await throws(
    () => db.query('user').include('derp').get(),
    false,
    'non existing field in include',
  )

  await throws(
    // @ts-ignore
    () => db.query('user', { $id: 1 }).get(),
    false,
    'incorrect alias',
  )

  await throws(
    () => db.query('user').filter('derp', '=', true).get(),
    false,
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
    false,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').filter('friend.description.flap', '=', 'nice').get(),
    false,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').filter('friend.description.fr', '=', 'nice').get(),
    false,
    'non existing lang in filter',
  )

  await throws(
    () => db.query('user').include('friend.description.flap').get(),
    false,
    'non existing lang in include #1',
  )

  await throws(
    () => db.query('user').include('friend.description.fr').get(),
    false,
    'non existing lang in include #2',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend.description.fr', 'derp', 1).get(),
    false,
    'Filter non existing operator',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend.description.en', '>', 1).get(),
    false,
    'Filter incorrect operator on text',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('rating', 'has', 1).get(),
    false,
    'Filter incorrect operator on uint32',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('isOn', 'has', 1).get(),
    false,
    'Filter incorrect operator on bool',
  )

  await db.query('user').filter('isOn', true).get()
  await db.query('user').filter('isOn').get()
  await db.query('user').filter('isOn', false).get()

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend', 'has', 1).get(),
    false,
    'Filter incorrect operator on reference',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('connections', 'like', 1).get(),
    false,
    'Filter incorrect operator on references',
  )

  const allData = [
    { id: 1, name: 'power user 0' },
    { id: 2, name: '' },
    { id: 3, name: 'power user 1' },
    { id: 4, name: '' },
    { id: 5, name: 'power user 2' },
    { id: 6, name: '' },
    { id: 7, name: 'power user 3' },
    { id: 8, name: '' },
    { id: 9, name: 'power user 4' },
    { id: 10, name: '' },
  ]

  deepEqual(
    await db
      .query('user')
      .filter('name', 'has', '')
      .include('name')
      .get()
      .toObject(),
    allData,
    'skip empty string',
  )

  deepEqual(
    await db
      .query('user', [])
      .filter('name', 'has', '')
      .include('name')
      .get()
      .toObject(),
    [],
    'ignore empty ids',
  )

  deepEqual(
    await db
      .query('user')
      .filter('friend.description.en', '=', undefined)
      .include('name')
      .get()
      .toObject(),
    allData,
    'skip undefined',
  )

  await throws(
    // @ts-ignore
    () => db.query('user').filter('friend.description', 'like', 999).get(),
    false,
    'Filter incorrect value on text',
  )

  await throws(
    // @ts-ignore
    () =>
      db
        // @ts-ignore
        .query({ id: 1, rating: 'derp' })
        .get(),
    false,
    'Incorrect payload',
  )

  const q = db.query('flap')
  for (let i = 0; i < 2; i++) {
    await throws(
      async () => {
        await q.get()
      },
      false,
      `Throw when using cached error #${i + 1}`,
    )
  }

  await throws(
    // @ts-ignore
    () =>
      db
        // @ts-ignore
        .query({ id: 1, rating: 'derp' })
        .get(),
    false,
    'Incorrect payload',
  )

  await db.query('user').sort('drip', 'desc').get()

  await throws(
    async () => {
      await db.query('user').sort('flurp').get()
    },
    false,
    'Non existing field on sort',
  )

  await throws(async () => {
    // @ts-ignore
    await db.query('user').sort('drip', 'gurk').get()
  }, false)

  await throws(async () => {
    await db.query('user').sort('connections').get()
  }, false)

  await throws(async () => {
    await db.query('user').sort('friend').get()
  }, false)

  await throws(async () => {
    await db.query('user', 1).sort('drip').get()
  }, false)

  await db.query('user', []).sort('drip').get()

  await db.query('user', [1, 2, 3]).sort('drip').get()

  await throws(async () => {
    await db.query('user').sort('drip').range(0, -10).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').sort('drip').range('derp', -100).get()
  }, false)

  await throws(async () => {
    await db.query('user').locale('az').get()
  }, false)

  await throws(async () => {
    await db.query('user').search('xyz', 'derpderp').get()
  }, false)

  await throws(async () => {
    await db.query('user').search('xyz', 'derpderp').get()
  }, false)

  await throws(async () => {
    await db.query('user').search('xyz', 'blap').get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').search([1, 2, 3, 4], 'blap').get()
  }, false)

  await throws(async () => {
    const envs = await db.query('user').filter('connections', 'has', 0).get()
  }, false)
})

await test('query - no schema', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  setTimeout(async () => {
    await db.setSchema({
      types: {
        user: {
          props: {
            name: 'string',
          },
        },
      },
    })
  }, 100)

  await throws(async () => {
    await db.query('ploink').get()
  }, false)

  await db.schemaIsSet()
  deepEqual(await db.query('user').get().toObject(), [])
})

await test('minmax', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          number: { type: 'number', min: 0, max: 1 },
        },
      },
    },
  })

  const id = await db.create('user', {
    name: 'luigi',
  })

  await db.update('user', id, {
    number: 0.5,
  })

  deepEqual(await db.query('user', id).get().toObject(), {
    name: 'luigi',
    number: 0.5,
    id,
  })
})

await test('set text without locale', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db)) // commenting this out fixes the crash part

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      country: {
        name: 'string',
        cool: 'text',
      },
    },
  })

  const country1 = await db.create('country', {
    name: 'Land1',
    cool: {
      it: 'italian text',
      en: 'english text',
    },
  })

  await db.update(
    'country',
    country1,
    {
      name: 'Land1',
      cool: 'italian text2',
    },
    { locale: 'it' },
  )

  await db.update('country', country1, {
    name: 'Land1',
    cool: 'english text2',
  })
})

await test('range validation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          rating: 'uint32',
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    await db.create('user', {
      name: `user ${i}`,
      rating: i,
    })
  }

  await db.query('user').range(0, 5).get()
  await db.query('user').range(1, 10).get()
  await db.query('user').range(0, 1).get()
  await db.query('user').range(100, 101).get()
  await db.query('user').range(1000, 1001).get()
  await db.query('user').range(0, undefined).get()

  await throws(async () => {
    await db.query('user').range(0, 0).get()
  }, false)

  await throws(async () => {
    await db.query('user').range(5, 5).get()
  }, false)

  await throws(async () => {
    await db.query('user').range(4294967295, 4294967295).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range('invalid', 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(-1, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(1.5, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(null, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(undefined, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range({}, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range([], 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(4294967296, 5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, 'invalid').get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, -1).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, 1.5).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, null).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, {}).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, []).get()
  }, false)

  await throws(async () => {
    // @ts-ignore
    await db.query('user').range(0, 4294967296).get()
  }, false)

  await throws(async () => {
    await db.query('user').range(5, 3).get()
  }, false)

  await db.query('user').filter('rating', '>', 0).range(0, 5).get()
  await db.query('user').sort('rating').range(0, 5).get()
  await db.query('user').include('name').range(0, 5).get()

  const result = await db
    .query('user')
    .range(0, 5)
    .include('name', 'rating')
    .get()
  deepEqual(result.length, 5)
})

await test('binary validation', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          binaryData: 'binary',
        },
      },
    },
  })

  await db.create('user', {
    name: 'test',
    binaryData: Buffer.from([1, 2, 3, 4]),
  })
  await db.create('user', { name: 'test2', binaryData: 'binary string' })
  await db.create('user', {
    name: 'test3',
    binaryData: new Uint8Array([5, 6, 7, 8]),
  })

  await throws(async () => {
    await db.create('user', { name: 'test4', binaryData: 123 })
  })

  await throws(async () => {
    await db.create('user', { name: 'test5', binaryData: { some: 'object' } })
  })

  await throws(async () => {
    await db.create('user', { name: 'test6', binaryData: [1, 2, 3] })
  })

  await db
    .query('user')
    .filter('binaryData', '=', Buffer.from([1, 2, 3, 4]))
    .get()
  await db.query('user').filter('binaryData', '=', 'binary string').get()
  await db
    .query('user')
    .filter('binaryData', '=', new Uint8Array([5, 6, 7, 8]))
    .get()

  await throws(async () => {
    await db.query('user').filter('binaryData', '=', 123).get()
  })

  await throws(async () => {
    await db.query('user').filter('binaryData', '=', {}).get()
  })

  await throws(async () => {
    await db.query('user').filter('binaryData', '=', { some: 'object' }).get()
  })

  await throws(async () => {
    await db.query('user').filter('binaryData', '=', [1, 2, 3]).get()
  })
})
