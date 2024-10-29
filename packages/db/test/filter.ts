import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'

await test('filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  const status = ['error', 'danger', 'ok']

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

  await db.create('env', {
    name: 'Mydev env',
    org,
  })

  const now = Date.now()
  let lastId = 0
  const m: number[] = []
  for (let i = 0; i < 1e5; i++) {
    lastId = db.create('machine', {
      env,
      status: status[Math.floor(Math.random() * status.length)],
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
})
