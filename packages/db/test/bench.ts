import { BasedDb } from '../src/index.js'
import { Sema } from 'async-sema'
import test from './shared/test.js'
import { start as startMulti } from './shared/multi.js'
import assert from 'node:assert'

const N = 1e7 // Nodes
const N2 = 1e3 // nr filter queries
const N3 = 1e4 // nr simple gets

const schema = {
  types: {
    test: {
      props: {
        x: 'uint32',
        //s: 'string',
        s: { type: 'string', maxBytes: 16 },
      },
    },
  },
} as const

const toxpsNum = (n, t) => n / (t / 1000)
const toxps = (n, t) => (n / (t / 1000)).toFixed(2)

await test('test embedded', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema(schema)

  let start = performance.now()
  let i = N
  while (i--) {
    db.create('test', {
      x: i % 100,
      s: `hello ${i}`,
    })
  }
  await db.drain()
  const ctime = performance.now() - start
  console.log(ctime, 'ms', toxps(N, ctime), 'c/s')

  const arr = Array.from({ length: N2 })
  start = performance.now()
  let res = (
    await Promise.all(
      arr.map(() =>
        db.query('test').filter('x', '=', 0).range(1, 10_001).get(),
      ),
    )
  ).reduce((prev, cur) => prev + cur.length, 0)
  const qtime = performance.now() - start
  assert(res === N)
  console.log(qtime, 'ms', toxps(N2, qtime), 'q/s')

  const s = new Sema(512)
  start = performance.now()
  await Promise.all(
    Array.from({ length: N3 }).map(async (_, i) => {
      await s.acquire()
      db.query('test', i + 1).get().then(() => s.release())
    }),
  )
  await s.drain()
  //res = (
  //  await Promise.all(
  //    Array.from({ length: N3 }).map((_, i) => db.query('test', i + 1).get()),
  //  )
  //).reduce((prev, cur) => prev + cur.length, 0)
  const qtime1 = performance.now() - start
  console.log(qtime1, 'ms', toxps(N3, qtime1), 'q/s')

  assert(toxpsNum(N, ctime) > 1000000)
  assert(toxpsNum(N2, qtime) > 500)
  assert(toxpsNum(N3, qtime1) > 10000000)
})

await test('test client-server', async (t) => {
  const {
    clients: [client1],
  } = await startMulti(t)

  await client1.setSchema(schema)

  let start = performance.now()

  let i = N
  while (i--) {
    client1.create('test', {
      x: i % 100,
      s: `hello ${i}`,
    })
  }

  await client1.drain()
  const ctime = performance.now() - start
  console.log(ctime, 'ms', toxps(N, ctime), 'c/s')

  const arr = Array.from({ length: N2 })
  start = performance.now()
  let res = (
    await Promise.all(
      arr.map(() =>
        client1.query('test').filter('x', '=', 0).range(1, 10_001).get(),
      ),
    )
  ).reduce((prev, cur) => prev + cur.length, 0)
  const qtime = performance.now() - start
  assert(res === 10000000)
  console.log(qtime, 'ms', toxps(N2, qtime), 'q/s')

  start = performance.now()
  res = (
    await Promise.all(
      Array.from({ length: N3 }).map((_, i) =>
        client1.query('test', i + 1).get(),
      ),
    )
  ).reduce((prev, cur) => prev + cur.length, 0)
  const qtime1 = performance.now() - start
  console.log(qtime1, 'ms', toxps(N3, qtime1), 'q/s')

  assert(toxpsNum(N, ctime) > 1000000)
  assert(toxpsNum(N2, qtime) > 500)
  assert(toxpsNum(N3, qtime1) > 1000000)
})
