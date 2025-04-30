import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('1M', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: 'mr z',
      age: 1 + i,
      email: i + '@z.z',
    })
  }

  const dbTime = await db.drain()
  equal(dbTime < 1000, true, 'db modify should not take longer then 1s')

  let d = Date.now()
  let siTime = Date.now() - d
  equal(
    siTime < 500,
    true,
    'creating string sort index should not take longer then 500ms',
  )

  const r = await db
    .query('user')
    .include('age', 'name', 'email')
    .range(0, 1e5)
    .sort('email')
    .filter('age', '>', 1e6 - 1e5)
    .get()

  deepEqual(
    r.node(0),
    {
      id: 900001,
      age: 900001,
      name: 'mr z',
      email: '900000@z.z',
    },
    'first node is correct',
  )

  d = Date.now()
  siTime = Date.now() - d
  equal(
    siTime < 250,
    true,
    `creating string sort index should not take longer then 250s (${siTime})`,
  )
})

await test('basic', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
        },
      },
    },
  })

  db.create('user', {
    age: 201,
    name: 'mr blap',
    email: 'blap@blap.blap.blap',
  })

  db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap.flap',
  })

  db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp.snurp',
  })

  await db.drain()

  db.create('user', {
    name: 'mr nurp',
    age: 200,
    email: 'nurp@nurp.nurp.nurp',
  })

  await db.drain()

  const mrZ = db.create('user', {
    name: 'mr z',
    age: 1,
    email: 'z@z.z',
  })

  await db.drain()

  deepEqual(
    (
      await db.query('user').sort('age', 'desc').include('email', 'age').get()
    ).toObject(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
    'sort by age desc',
  )

  deepEqual(
    (
      await db.query('user').sort('age', 'asc').include('email', 'age').get()
    ).toObject(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
    'sort by age asc',
  )

  await db.drain()

  deepEqual(
    await db.query('user').sort('email', 'asc').include('email', 'age').get(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
    'sort by email asc',
  )

  deepEqual(
    await db.query('user').sort('email', 'desc').include('email', 'age').get(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ].reverse(),
    'sort by email desc',
  )

  const mrX = db.create('user', {
    name: 'mr x',
    age: 999,
    email: 'x@x.x',
  })

  await db.drain()

  deepEqual(
    await db.query('user').sort('email').include('email', 'age').get(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 6, email: 'x@x.x', age: 999 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
    'sort by email asc after adding new',
  )

  deepEqual(
    await db.query('user').sort('age').include('email', 'age').get(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'x@x.x', age: 999 },
    ],
    'sort by age asc after adding new',
  )

  db.update('user', mrX, {
    email: 'dd@dd.dd',
  })

  await db.drain()

  deepEqual(
    await db.query('user').sort('email').include('email', 'age').get(),
    [
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'dd@dd.dd', age: 999 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 5, email: 'z@z.z', age: 1 },
    ],
    'sort by email after updating email',
  )

  db.update(
    'user',
    mrX,
    {
      age: 1e6,
    },
    { overwrite: true },
  )

  await db.drain()

  deepEqual(
    await db.query('user').sort('age').include('email', 'age').get(),
    [
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
      { id: 6, email: 'dd@dd.dd', age: 1e6 },
    ],
    'sort by age after update',
  )

  db.update('user', mrX, {
    age: 0,
  })

  await db.drain()

  deepEqual(
    await db.query('user').sort('age').include('email', 'age').get(),
    [
      { id: 6, email: 'dd@dd.dd', age: 0 },
      { id: 5, email: 'z@z.z', age: 1 },
      { id: 2, email: 'flap@flap.flap.flap', age: 50 },
      { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
      { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
      { id: 1, email: 'blap@blap.blap.blap', age: 201 },
    ],
    'update mrX to age 0',
  )

  deepEqual(await db.query('user').sort('age').include('email', 'age').get(), [
    { id: 6, email: 'dd@dd.dd', age: 0 },
    { id: 5, email: 'z@z.z', age: 1 },
    { id: 2, email: 'flap@flap.flap.flap', age: 50 },
    { id: 3, email: 'snurp@snurp.snurp.snurp', age: 99 },
    { id: 4, email: 'nurp@nurp.nurp.nurp', age: 200 },
    { id: 1, email: 'blap@blap.blap.blap', age: 201 },
  ])

  const ids = []
  for (let i = 0; i < 10; i++) {
    ids.push(i + 1)
    db.create('user', {
      name: 'mr ' + i,
      age: i + 300,
      email: i + '@z.z',
    })
  }

  await db.drain()

  deepEqual(
    await db.query('user', ids).include('name', 'age').sort('age').get(),
    [
      { id: 6, name: 'mr x', age: 0 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 10, name: 'mr 3', age: 303 },
    ],
    'Sort by ids after creation (asc)',
  )

  deepEqual(
    await db
      .query('user', ids)
      .include('name', 'age')
      .sort('age', 'desc')
      .get(),
    [
      { id: 10, name: 'mr 3', age: 303 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 6, name: 'mr x', age: 0 },
    ],
    'Sort by ids after creation (desc)',
  )

  const ids2 = []
  for (let i = 1; i < 1000; i++) {
    ids2.push(i)
  }

  deepEqual(
    await db
      .query('user', ids2)
      .include('name', 'age')
      .sort('age', 'asc')
      .get(),
    [
      { id: 6, name: 'mr x', age: 0 },
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 10, name: 'mr 3', age: 303 },
      { id: 11, name: 'mr 4', age: 304 },
      { id: 12, name: 'mr 5', age: 305 },
      { id: 13, name: 'mr 6', age: 306 },
      { id: 14, name: 'mr 7', age: 307 },
      { id: 15, name: 'mr 8', age: 308 },
      { id: 16, name: 'mr 9', age: 309 },
    ],
  )

  db.delete('user', mrX)

  await db.drain()

  deepEqual(
    await db
      .query('user', ids2)
      .include('name', 'age')
      .sort('age', 'asc')
      .get(),
    [
      { id: 5, name: 'mr z', age: 1 },
      { id: 2, name: 'mr flap', age: 50 },
      { id: 3, name: 'mr snurp', age: 99 },
      { id: 4, name: 'mr nurp', age: 200 },
      { id: 1, name: 'mr blap', age: 201 },
      { id: 7, name: 'mr 0', age: 300 },
      { id: 8, name: 'mr 1', age: 301 },
      { id: 9, name: 'mr 2', age: 302 },
      { id: 10, name: 'mr 3', age: 303 },
      { id: 11, name: 'mr 4', age: 304 },
      { id: 12, name: 'mr 5', age: 305 },
      { id: 13, name: 'mr 6', age: 306 },
      { id: 14, name: 'mr 7', age: 307 },
      { id: 15, name: 'mr 8', age: 308 },
      { id: 16, name: 'mr 9', age: 309 },
    ],
  )

  const mrBlurp = db.create('user', {
    age: 99,
  })

  await db.drain()

  equal(
    (await db.query('user', ids2).include('name', 'age', 'email').get()).length,
    16,
    'Check default query after remove',
  )

  equal(
    (
      await db
        .query('user', ids2)
        .include('name', 'age', 'email')
        .sort('email')
        .get()
    ).length,
    16,
    'Check email index len after removal',
  )

  equal(
    (
      await db
        .query('user', ids2)
        .include('name', 'age', 'email')
        .sort('name')
        .get()
    ).length,
    16,
    'Check name index len after removal',
  )

  db.delete('user', mrBlurp)

  await db.drain()

  equal(
    (
      await db
        .query('user', ids2)
        .include('name', 'age', 'email')
        .sort('name')
        .get()
    ).length,
    15,
    'Check name index len after removal (2)',
  )

  db.update('user', mrZ, {
    email: '',
  })

  await db.drain()

  equal(
    (
      await db
        .query('user', ids2)
        .include('name', 'age', 'email')
        .sort('email')
        .get()
    ).length,
    15,
    'Check email index len after removal (2)',
  )

  db.delete('user', mrZ)

  await db.drain()

  equal(
    (
      await db
        .query('user', ids2)
        .include('name', 'age', 'email')
        .sort('email')
        .get()
    ).length,
    14,
    'Check email index len after removal (3)',
  )
})

await test('sort - from start (1M items)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  // db.blockSize = 1e5

  await db.setSchema({
    types: {
      user: {
        props: {
          gender: { type: 'uint32' },
          age: { type: 'uint32' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  })

  db.create('user', {
    name: 'mr blap',
    age: 100,
    email: 'blap@blap.blap.blap',
  })

  db.create('user', {
    name: 'mr flap',
    age: 50,
    email: 'flap@flap.flap.flap',
  })

  for (let i = 0; i < 1000e3; i++) {
    db.create('user', {
      name: 'mr ' + i,
      age: i + 101,
    })
  }

  await db.drain()

  deepEqual(
    await db.query('user').include('name').sort('age').range(0, 2).get(),
    [
      { id: 2, name: 'mr flap' },
      { id: 1, name: 'mr blap' },
    ],
  )

  deepEqual(
    await db.query('user').include('name').sort('age').range(0, 2).get(),
    [
      { id: 2, name: 'mr flap' },
      { id: 1, name: 'mr blap' },
    ],
  )

  deepEqual(
    await db
      .query('user')
      .include('name')
      .sort('name')
      .range(0, 2)
      .get()
      .inspect(2),
    [
      {
        id: 3,
        name: 'mr 0',
      },
      {
        id: 4,
        name: 'mr 1',
      },
    ],
  )

  await db.stop()

  const newDb = new BasedDb({
    path: t.tmp,
  })

  await newDb.start()

  newDb.server.createSortIndex('user', 'age')
  newDb.server.createSortIndex('user', 'name')

  t.after(() => newDb.destroy())

  deepEqual(
    (
      await newDb.query('user').include('name').sort('name').range(0, 2).get()
    ).toObject(),
    [
      {
        id: 3,
        name: 'mr 0',
      },
      {
        id: 4,
        name: 'mr 1',
      },
    ],
  )

  newDb.server.destroySortIndex('user', 'age')
})

await test('unset value on create', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  db.setSchema({
    types: {
      dialog: {
        props: {
          fun: {
            type: 'string',
          },
        },
      },
    },
  })

  await db.query('dialog').sort('fun', 'desc').get().toObject()

  const id1 = await db.create('dialog', {
    fun: '1',
  })

  const id2 = await db.create('dialog', {
    fun: '2',
  })

  const id3 = await db.create('dialog', {
    fun: '3',
  })

  const id4 = await db.create('dialog', {})

  const id5 = await db.create('dialog', {})

  deepEqual(
    await db.query('dialog').sort('fun', 'desc').get().toObject(),
    [
      {
        id: 3,
        fun: '3',
      },
      {
        id: 2,
        fun: '2',
      },
      {
        id: 1,
        fun: '1',
      },
      {
        id: 4,
        fun: '',
      },
      {
        id: 5,
        fun: '',
      },
    ],
    'first',
  )

  deepEqual(await db.query('dialog').sort('fun', 'desc').get().toObject(), [
    { id: 3, fun: '3' },
    { id: 2, fun: '2' },
    { id: 1, fun: '1' },
    { id: 4, fun: '' },
    { id: 5, fun: '' },
  ])

  await db.update('dialog', id5, {
    fun: '0',
  })

  deepEqual(await db.query('dialog').sort('fun', 'desc').get().toObject(), [
    {
      id: 3,
      fun: '3',
    },
    {
      id: 2,
      fun: '2',
    },
    {
      id: 1,
      fun: '1',
    },
    {
      id: 5,
      fun: '0',
    },
    {
      id: 4,
      fun: '',
    },
  ])

  db.delete('dialog', id5)
  await db.drain()

  deepEqual(await db.query('dialog').sort('fun', 'desc').get().toObject(), [
    {
      id: 3,
      fun: '3',
    },
    {
      id: 2,
      fun: '2',
    },
    {
      id: 1,
      fun: '1',
    },
    {
      id: 4,
      fun: '',
    },
  ])
})
