import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal, deepEqual } from './shared/assert.js'

await test('filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  const status = ['error', 'danger', 'ok', '🦄']

  db.putSchema({
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
  let lastId = 0
  const m: number[] = []
  for (let i = 0; i < 1e5; i++) {
    lastId = db.create('machine', {
      env,
      status: status[Math.floor(Math.random() * (status.length - 1))],
      requestsServed: i,
      lastPing: i + 1,
      derp: -i,
      temperature: Math.random() * 40 - Math.random() * 40,
      isLive: !!(i % 2),
      scheduled: now + (i % 3 ? -i * 6e5 : i * 6e5),
    }).tmpId
    if (i % 2) {
      m.push(lastId)
    }
  }

  db.update('env', env, {
    machines: m,
  })

  db.drain()

  const x = [300, 400, 10, 20, 1, 2, 99, 9999, 888, 6152]
  equal(
    db.query('machine').include('*').filter('lastPing', '=', x).get().toObject()
      .length,
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
  for (let i = 0; i < amount; i++) {
    const rand = ~~(Math.random() * lastId)
    const derp = [make(), make(), make(), rand]
    const envs = db
      .query('env')
      .include('*')
      .filter('machines', 'has', derp)
      .get()

    mi += envs.toObject().length
    measure += envs.execTime
  }

  equal(
    mi / amount > 0.4 && mi / amount < 0.6,
    true,
    'multi ref OR filter up at 0.5 results',
  )
  equal(measure / amount < 0.05, true, 'multi ref OR filter lower then 0.1ms')

  measure = 0
  mi = 0
  for (let i = 0; i < amount; i++) {
    const rand = ~~(Math.random() * lastId)
    const envs = db
      .query('env')
      .include('*')
      .filter('machines', 'has', rand)
      .get()

    mi += envs.toObject().length
    measure += envs.execTime
  }
  equal(
    mi / amount > 0.4 && mi / amount < 0.6,
    true,
    'multi ref filter up at 0.5 results',
  )
  equal(measure / amount < 0.05, true, 'multi ref filter lower then 0.1ms')

  equal(
    db
      .query('machine')
      .include('*')
      .filter('scheduled', '>', 'now + 694d + 10h')
      .get()
      .toObject().length,
    1,
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('scheduled', '<', 'now-694d-10h-15m') // Date,
      .get()
      .toObject().length,
    1,
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('scheduled', '<', '10/24/2000') // Date,
      .get()
      .toObject().length,
    0,
    'parse date string',
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('requestsServed', '<', 1)
      .get()
      .toObject().length,
    1,
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('requestsServed', '<=', 1)
      .get()
      .toObject().length,
    2,
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('derp', '<=', 0)
      .filter('derp', '>', -5)
      .get()
      .toObject().length,
    5,
    'Negative range',
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('temperature', '<=', 0)
      .filter('temperature', '>', -0.1)
      .get()
      .toObject().length < 500,
    true,
    'Negative temperature (result amount)',
  )

  equal(
    db
      .query('machine')
      .include('*')
      .filter('temperature', '<=', 0)
      .filter('temperature', '>', -0.1)
      .get()
      .toObject()[0].temperature < 0,
    true,
    'Negative temperature (check value)',
  )

  equal(
    db
      .query('machine')
      .include('id')
      .filter('env', '=', env)
      .range(0, 10)
      .get()
      .toObject(),
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
    db
      .query('machine')
      .include('id')
      .filter('lastPing', '>=', 1e5 - 1) // order optmization automaticly
      .filter('env', '=', [emptyEnv, env])
      .range(0, 10)
      .get()
      .toObject(),
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
      env: derpEnv,
      // env: { id: derpEnv, $rating: 0.5 },
      lastPing: 1,
    }),
    db.create('machine', {
      temperature: 2,
      env: derpEnv,
      // env: { id: derpEnv, $rating: 0.75 },
      lastPing: 2,
    }),
    db.create('machine', {
      temperature: 3,
      env: derpEnv,
      // env: { id: derpEnv, $rating: 1 },
      lastPing: 3,
    }),
  ])

  deepEqual(
    db.query('env').filter('machines', '<', 10).get().toObject(),
    [
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
    db.query('env').filter('machines', '=', ids).get().toObject(),
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
    db
      .query('machine')
      .include('env', '*')
      .filter('env.status', '=', 5)
      .get()
      .toObject(),
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
    db
      .query('machine')
      .filter('status', '=', '🦄')
      .include('status')
      .get()
      .toObject(),
    [
      {
        id: unicornMachine,
        status: '🦄',
      },
    ],
  )

  deepEqual(db.query('env').filter('standby').get().toObject(), [])

  await db.update('env', derpEnv, {
    standby: true,
  })

  deepEqual(db.query('env').filter('standby').get().toObject(), [
    { id: 3, standby: true, status: 5, name: 'derp env' },
  ])

  const rangeResult = db
    .query('machine')
    .include('*')
    .filter('temperature', '..', [-0.1, 0])
    .get()

  equal(rangeResult.length < 1000, true, 'range excludes ')
  equal(
    rangeResult.node().temperature < 0 && rangeResult.node().temperature > -0.1,
    true,
    'range',
  )
})
