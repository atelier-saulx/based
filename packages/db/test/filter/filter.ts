import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { equal, deepEqual } from '../shared/assert.js'

await test('single', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const status = ['error', 'danger', 'ok', '🦄']

  await db.setSchema({
    types: {
      org: {
        props: {
          status,
          name: 'string',
          x: 'number',
          orgs: {
            items: {
              ref: 'org',
              prop: '_o',
            },
          },
        },
      },
    },
  })

  const org = await db.create('org', {
    status: 'ok',
    name: 'hello',
    x: 10,
  })

  const org2 = await db.create('org', {
    status: 'ok',
    name: 'x',
  })

  await db.create('org', {
    name: 'hello ???????',
    orgs: [org, org2],
  })

  const x = [10, 20]

  deepEqual((await db.query('org').filter('x', '=', x).get()).toObject(), [
    {
      id: 1,
      status: 'ok',
      x: 10,
      name: 'hello',
    },
  ])
  deepEqual(
    (await db.query('org').filter('orgs', '=', [org, org2]).get()).toObject(),
    [
      {
        id: 3,
        status: undefined,
        x: 0,
        name: 'hello ???????',
      },
    ],
  )
  deepEqual(
    (await db.query('org').filter('status', '=', 'error').get()).toObject(),
    [],
  )
  deepEqual(
    (await db.query('org').filter('status', '=', 'ok').get()).toObject(),
    [
      {
        id: 1,
        status: 'ok',
        x: 10,
        name: 'hello',
      },
      {
        id: 2,
        status: 'ok',
        x: 0,
        name: 'x',
      },
    ],
  )
  deepEqual(
    (await db.query('org').filter('name', 'has', '0').get()).toObject(),
    [],
  )
  deepEqual(
    (await db.query('org').filter('name', 'has', 'hello').get()).toObject(),
    [
      {
        id: 1,
        status: 'ok',
        x: 10,
        name: 'hello',
      },
      {
        id: 3,
        status: undefined,
        x: 0,
        name: 'hello ???????',
      },
    ],
  )
})

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const status = ['error', 'danger', 'ok', '🦄']

  await db.setSchema({
    types: {
      org: {
        props: {
          name: 'string',
          type: ['public', 'private', 'person'],
          envs: {
            items: {
              ref: 'env',
              prop: 'org',
            },
          },
        },
      },
      env: {
        props: {
          standby: 'boolean',
          status: 'uint8',
          name: 'string',
          org: {
            ref: 'org',
            prop: 'envs',
          },
          machines: {
            items: {
              ref: 'machine',
              prop: 'env',
            },
          },
        },
      },
      machine: {
        props: {
          derp: 'int32',
          lastPing: 'number',
          temperature: 'number',
          requestsServed: 'uint32',
          env: {
            ref: 'env',
            prop: 'machines',
            $rating: 'number',
          },
          isLive: 'boolean',
          status,
          scheduled: 'timestamp',
        },
      },
    },
  })

  const org = await db.create('org', {
    name: 'My small org',
    type: 'person',
  })

  const env = await db.create('env', {
    name: 'My small org env',
    org,
  })

  const emptyEnv = await db.create('env', {
    name: 'Mydev env',
    org,
  })

  const now = Date.now()
  let lastNode: ReturnType<typeof db.create>
  const m = []
  for (let i = 0; i < 1e5; i++) {
    lastNode = db.create('machine', {
      env,
      status: status[Math.floor(Math.random() * (status.length - 1))],
      requestsServed: i,
      lastPing: i + 1,
      derp: -i,
      temperature: Math.random() * 40 - Math.random() * 40,
      isLive: !!(i % 2),
      scheduled: now + (i % 3 ? -i * 6e5 : i * 6e5),
    })
    if (i % 2) {
      m.push(lastNode)
    }
  }

  db.update('env', env, {
    machines: m,
  })

  await db.drain()
  const lastId = await lastNode
  const x = [300, 400, 10, 20, 1, 2, 99, 9999, 888, 6152]

  equal(
    (await db.query('machine').filter('lastPing', '=', x).get()).length,
    x.length,
    'OR number',
  )

  const make = () => {
    const x = ~~(Math.random() * lastId)
    if (x % 2 == 0) {
      return make()
    }
    return x
  }

  const amount = 1000

  var measure = 0
  var mi = 0

  const res = await Promise.all(
    Array.from({ length: amount }).map(() => {
      const rand = ~~(Math.random() * lastId) || 1
      const derp = [make(), make(), make(), rand]
      return db.query('env').include('*').filter('machines', 'has', derp).get()
    }),
  )

  for (const envs of res) {
    mi += envs.toObject().length
    measure += envs.execTime
  }

  equal(
    mi / amount > 0.4 && mi / amount < 0.6,
    true,
    'multi ref OR filter up at 0.5 results',
  )

  equal(measure / amount < 20, true, 'multi ref OR filter lower then 20ms')

  measure = 0
  mi = 0

  await Promise.all(
    Array.from({ length: amount }).map(async () => {
      const rand = ~~(Math.random() * lastId) || 1
      const envs = await db
        .query('env')
        .include('*')
        .filter('machines', 'has', rand)
        .get()
      mi += envs.toObject().length
      measure += envs.execTime
    }),
  )

  equal(
    mi / amount > 0.4 && mi / amount < 0.6,
    true,
    'multi ref filter up at 0.5 results',
  )
  equal(measure / amount < 100, true, 'multi ref filter lower then 100ms')

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('scheduled', '>', 'now + 694d + 10h')
        .get()
    ).toObject().length,
    1,
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('scheduled', '<', 'now-694d-10h-15m') // Date,
        .get()
    ).toObject().length,
    1,
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('scheduled', '<', '10/24/2000') // Date,
        .get()
    ).toObject().length,
    0,
    'parse date string',
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('requestsServed', '<', 1)
        .get()
    ).toObject().length,
    1,
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('requestsServed', '<=', 1)
        .get()
    ).toObject().length,
    2,
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('derp', '<=', 0)
        .filter('derp', '>', -5)
        .get()
    ).toObject().length,
    5,
    'Negative range',
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('temperature', '<=', 0)
        .filter('temperature', '>', -0.1)
        .get()
    ).toObject().length < 500,
    true,
    'Negative temperature (result amount)',
  )

  equal(
    (
      await db
        .query('machine')
        .include('*')
        .filter('temperature', '<=', 0)
        .filter('temperature', '>', -0.1)
        .get()
    ).toObject()[0].temperature < 0,
    true,
    'Negative temperature (check value)',
  )

  equal(
    (
      await db
        .query('machine')
        .include('id')
        .filter('env', '=', env)
        .range(0, 10)
        .get()
    ).toObject(),
    [
      { id: 2 },
      { id: 4 },
      { id: 6 },
      { id: 8 },
      { id: 10 },
      { id: 12 },
      { id: 14 },
      { id: 16 },
      { id: 18 },
      { id: 20 },
    ],
    'Filter by reference',
  )

  equal(
    (
      await db
        .query('machine')
        .include('id')
        .filter('lastPing', '>=', 1e5 - 1) // order optmization automaticly
        .filter('env', '=', [emptyEnv, env])
        .range(0, 10)
        .get()
    ).toObject(),
    [{ id: 100000 }],
    'Filter by reference (multiple)',
  )

  const derpEnv = await db.create('env', {
    name: 'derp env',
    status: 5,
  })

  const ids = await Promise.all([
    db.create('machine', {
      temperature: 20,
      // env: derpEnv,
      env: { id: derpEnv, $rating: 0.5 },
      lastPing: 1,
    }),
    db.create('machine', {
      temperature: 2,
      // env: derpEnv,
      env: { id: derpEnv, $rating: 0.75 },
      lastPing: 2,
    }),
    db.create('machine', {
      temperature: 3,
      // env: derpEnv,
      env: { id: derpEnv, $rating: 1 },
      lastPing: 3,
    }),
  ])

  deepEqual(
    await db.query('env').filter('machines', '<', 10).get(),
    [
      {
        id: 2,
        name: 'Mydev env',
        standby: false,
        status: 0,
      },
      {
        id: 3,
        name: 'derp env',
        status: 5,
        standby: false,
      },
    ],
    'Filter by references length',
  )

  deepEqual(
    await db.query('env').filter('machines', '=', ids).get(),
    [
      {
        id: 3,
        name: 'derp env',
        status: 5,
        standby: false,
      },
    ],
    'Filter by references equals',
  )

  deepEqual(
    (
      await db
        .query('machine')
        .include('env', '*')
        .filter('env.status', '=', 5)
        .get()
    ).toObject(),
    [
      {
        id: 100001,
        derp: 0,
        lastPing: 1,
        temperature: 20,
        requestsServed: 0,
        isLive: false,
        status: undefined,
        scheduled: 0,
        env: { id: 3, status: 5, name: 'derp env', standby: false },
      },
      {
        id: 100002,
        derp: 0,
        lastPing: 2,
        temperature: 2,
        requestsServed: 0,
        isLive: false,
        status: undefined,
        scheduled: 0,
        env: { id: 3, status: 5, name: 'derp env', standby: false },
      },
      {
        id: 100003,
        derp: 0,
        lastPing: 3,
        temperature: 3,
        requestsServed: 0,
        isLive: false,
        status: undefined,
        scheduled: 0,
        env: { id: 3, status: 5, name: 'derp env', standby: false },
      },
    ],
  )

  const unicornMachine = await db.create('machine', {
    status: '🦄',
  })

  deepEqual(
    (
      await db
        .query('machine')
        .filter('status', '=', '🦄')
        .include('status')
        .get()
    ).toObject(),
    [
      {
        id: unicornMachine,
        status: '🦄',
      },
    ],
  )

  deepEqual((await db.query('env').filter('standby').get()).toObject(), [])

  await db.update('env', derpEnv, {
    standby: true,
  })

  deepEqual((await db.query('env').filter('standby').get()).toObject(), [
    { id: 3, standby: true, status: 5, name: 'derp env' },
  ])

  let rangeResult = await db
    .query('machine')
    .include('temperature')
    .filter('temperature', '..', [-0.1, 0])
    .get()

  equal(rangeResult.length < 900, true, 'range less')
  equal(
    rangeResult.node().temperature < 0 && rangeResult.node().temperature > -0.1,
    true,
    'range',
  )

  rangeResult = await db
    .query('machine')
    .include('*')
    .range(0, 10)
    // .filter('temperature', '!..', [-0.1, 0])
    .filter('temperature', '>', 0)
    .or('temperature', '<', -0.1)
    .get()

  let hasLarge = false
  let hasSmall = false
  for (const item of rangeResult) {
    if (item.temperature < -0.1) {
      hasSmall = true
    }
    if (item.temperature > 0) {
      hasLarge = true
    }
    if (item.temperature > -0.1 && item.temperature < 0) {
      throw new Error('Incorrect exclusive range (temp > -0.1 && temp < 0)')
    }
  }
  if (!hasSmall || !hasLarge) {
    throw new Error(
      `Incorrect exclusive range large: ${hasLarge} small: ${hasSmall}`,
    )
  }
})

await test('or', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const status = ['error', 'danger', 'ok', '🦄']

  await db.setSchema({
    types: {
      machine: {
        props: {
          derp: 'int32',
          lastPing: 'number',
          temperature: 'number',
          requestsServed: 'uint32',
          isLive: 'boolean',
          status,
          scheduled: 'timestamp',
        },
      },
    },
  })

  const now = Date.now()
  for (let i = 0; i < 1e6; i++) {
    db.create('machine', {
      status: status[Math.floor(Math.random() * (status.length - 1))],
      requestsServed: i,
      lastPing: i + 1,
      derp: -i,
      temperature: Math.random() * 40 - Math.random() * 40,
      isLive: !!(i % 2),
      scheduled: now + (i % 3 ? -i * 6e5 : i * 6e5),
    })
  }

  await db.drain()

  deepEqual(
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or('lastPing', '>', 1e6 - 2)
        .get()
    ).toObject(),
    [
      {
        id: 999999,
        lastPing: 999999,
      },
      {
        id: 1000000,
        lastPing: 1000000,
      },
    ],
  )

  deepEqual(
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or((f) => {
          f.filter('lastPing', '>', 1e6 - 2)
        })
        .get()
    ).toObject(),
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or('lastPing', '>', 1e6 - 2)
        .get()
    ).toObject(),
  )

  equal(
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or((f) => {
          f.filter('lastPing', '>', 1e6 - 2)
          f.or('temperature', '<', -30)
        })
        .get()
    ).toObject().length > 10,
    true,
    'Branch or',
  )

  deepEqual(
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or((f) => {
          f.filter('lastPing', '>', 1e6 - 2)
          f.or((f) => {
            f.filter('temperature', '<', -30)
          })
        })
        .get()
    ).toObject(),
    (
      await db
        .query('machine')
        .include('id', 'lastPing')
        .filter('scheduled', '>', '01/01/2100')
        .or((f) => {
          f.filter('lastPing', '>', 1e6 - 2)
          f.or('temperature', '<', -30)
        })
        .get()
    ).toObject(),
  )

  const r = (
    await db
      .query('machine')
      .include('temperature')
      .range(0, 15)
      .filter('temperature', '>', 0)
      .or('temperature', '<', -0.1)
      .get()
  ).toObject()

  equal(
    r
      .map((v, i) => {
        return v.temperature > 0 ? true : false
      })
      .reduce((acc, a) => {
        return a ? acc + 1 : acc
      }, 0) > 0,
    true,
    'Correct spread of temperature',
  )
})

await test('or numerical', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      machine: {
        props: {
          temperature: 'uint8',
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('machine', {
      temperature: ~~(Math.random() * 200) + 1,
    })
  }
  await db.drain()

  const r = (
    await db
      .query('machine')
      .include('temperature')
      .range(0, 1000)
      .filter('temperature', '>', 150)
      .or('temperature', '<', 50)
      .get()
  ).toObject()

  equal(
    r
      .map((v, i) => {
        return v.temperature < 50
      })
      .reduce((acc, a) => {
        return a ? acc + 1 : acc
      }, 0) > 0,
    true,
  )

  equal(
    r
      .map((v, i) => {
        return v.temperature > 150
      })
      .reduce((acc, a) => {
        return a ? acc + 1 : acc
      }, 0) > 0,
    true,
  )

  equal(
    (
      await db
        .query('machine')
        .include('id', 'temperature')
        .filter('temperature', '>', 201)
        .or((f) => {
          f.filter('temperature', '>', 202)
          f.or('temperature', '<', 10)
        })
        .get()
    ).toObject().length > 10,
    true,
    'Branch or',
  )

  for (let i = 0; i < 10000; i++) {
    if (i % 2) {
      db.delete('machine', 10000 + i)
    }
  }
  await db.drain()

  deepEqual(
    (await db.query('machine').include('id').range(0, 3).get()).node(-1),
    {
      id: 3,
    },
  )

  deepEqual(
    (
      await db
        .query('machine')
        .include('temperature')
        .filter('id', '<=', 20000)
        .range(10000, 20000)
        .get()
    ).node(-1).id,
    20000,
  )
})

await test.skip('has', async (t) => {
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
          age: { type: 'uint32' },
          bestBud: {
            // single Ref
            ref: 'user',
            prop: 'bestBudOf',
          },
          buddies: {
            // multiple Ref
            items: {
              ref: 'user',
              prop: 'buddies',
            },
          },
        },
      },
    },
  })

  const ildo1 = db.create('user', {
    name: 'Clemildo',
    age: 29,
  })
  const ildo2 = db.create('user', {
    name: 'Josefildo',
    age: 34,
  })
  const ildo3 = db.create('user', {
    name: 'Adeildo',
    age: 50,
    bestBud: ildo2,
    buddies: [ildo1, ildo2],
  })

  // filtering refs
  await db
    .query('user')
    .include('*')
    .filter('bestBud.name', 'has', 'Jose')
    .get()
    .inspect(10)

  // filtering multi refs
  await db
    .query('user')
    .include(
      (q) => q('buddies').include('*').filter('name', 'has', 'Jose'),
      '*',
    )
    .get()
    .inspect(10)
  // because we can't apply .filter() over a .filter() return we have to use JS .filter()
  console.log(
    JSON.stringify(
      (
        await db
          .query('user')
          .include(
            (q) => q('buddies').include('*').filter('name', 'has', 'Jose'),
            '*',
          )
          .get()
          .toObject()
      ).filter((u) => u.buddies.length > 0),
    ),
  )
})
