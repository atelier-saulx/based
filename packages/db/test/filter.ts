import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

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
          lastPing: 'timestamp',
          requestsServed: 'uint32',
          env: {
            ref: 'env',
            prop: 'machines',
          },
          isLive: 'boolean',
          status,
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

  const env2 = await db.create('env', {
    name: 'Mydev env',
    org,
  })

  const d = Date.now()
  let lastId = 0
  const m: number[] = []
  for (let i = 0; i < 10000; i++) {
    lastId = db.create('machine', {
      env,
      status: status[Math.floor(Math.random() * status.length)],
      requestsServed: i,
      lastPing: i + 1,
    }).tmpId

    if (Math.random() > 0.5) {
      db.remove('machine', lastId)
    }

    m.push(lastId)
  }
  // db.update('env', env, {
  //   machines: m,
  // })
  console.log(lastId, db.drain(), 'ms')

  // const result = db.query('org').include('*', 'envs.machines.*', 'env.*').get()
  // console.log(result)

  const x = [300, 400, 10, 20, 1, 2, 99, 9999, 888, 6152]

  const machines = db
    .query('machine')
    .include('*')
    .filter('lastPing', '=', x)
    .get()

  console.log(machines)

  // console.log(lastId)

  var measure = 0
  var mi = 0
  var lastId1 = lastId - 1

  const xx = 3
  const bla = [xx, lastId + 100, lastId + 10, lastId + 1000]

  const amount = 1
  for (let i = 0; i < amount; i++) {
    const envs = db
      .query('env')
      .include('*')
      .include('machines')
      // .filter('machines', 'has', lastId)
      .filter('machines', 'has', bla)
      // .filter('lastPing', '=', [1000, 2, 3, 4])
      .get()

    console.log(envs.toObject())
    mi += envs.toObject().length
    measure += envs.execTime
  }

  console.log(measure / amount, 'ms', mi / amount)
})
