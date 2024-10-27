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

  let lastId = 0
  const m: number[] = []
  for (let i = 0; i < 196608; i++) {
    lastId = db.create('machine', {
      // env,
      // status: status[Math.floor(Math.random() * status.length)],
      // requestsServed: i,
      // lastPing: i + 1,
    }).tmpId

    // if (Math.random() > 0.5) {
    //   db.remove('machine', lastId)
    // }

    if (i % 2) {
      m.push(lastId)
    }
  }
  db.update('env', env, {
    machines: m,
  })
  console.log(lastId, db.drain(), 'ms')

  const result = db.query('org').include('*', 'envs.machines.id', 'env.*').get()
  console.log(result.toObject()[0].envs[0].machines.map((v) => v.id))

  const x = [300, 400, 10, 20, 1, 2, 99, 9999, 888, 6152]

  // const machines = db
  //   .query('machine')
  //   .include('*')
  //   .filter('lastPing', '=', x)
  //   .get()

  // console.log(machines)

  // console.log(lastId)

  var measure = 0
  var mi = 0
  var lastId1 = lastId - 1

  const xx = lastId - 1
  const bla = [xx, lastId + 100, lastId + 10, lastId + 1000]

  const amount = 1

  const make = () => {
    const x = ~~(Math.random() * lastId)
    if (x % 2 == 0) {
      return make()
    }
    return x
  }

  for (let i = 0; i < amount; i++) {
    // var g = 0
    const rand = ~~(Math.random() * lastId)
    const derp = [make(), make(), make(), rand]
    console.log(derp)
    const envs = db
      .query('env')
      .include('*')
      // .include('machines')
      // .filter('machines', 'has', rand)
      // .filter('machines', 'has', 25)
      // .filter('machines', 'has', ~~(Math.random() * lastId) % 2)
      .filter('machines', 'has', derp)

      // .filter('machines', 'has', [
      //   // 0 or - completely blows it up
      //   ~~(Math.random() * lastId) - ~~(Math.random() * lastId) + 1,
      //   ~~(Math.random() * lastId) - ~~(Math.random() * lastId) + 1,
      //   ~~(Math.random() * lastId) - ~~(Math.random() * lastId) + 1,
      //   // ~~(Math.random() * lastId) - ~~(Math.random() * lastId) + 1,
      //   lastId,
      // ])

      // .filter('lastPing', '=', [1000, 2, 3, 4])
      .get()

    // console.log(envs.toObject())
    mi += envs.toObject().length
    measure += envs.execTime
  }

  console.log(measure / amount, 'ms', mi / amount)
})
