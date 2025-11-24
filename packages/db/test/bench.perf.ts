import { BasedDb } from '../src/index.js'
import { Sema } from 'async-sema'
import test from './shared/test.js'
import { start as startMulti } from './shared/multi.js'
import assert from 'node:assert'
import { perf } from './shared/assert.js'

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

  const ctime = await perf(async () => {
    let i = N
    while (i--) {
      db.create('test', {
        x: i % 100,
        s: `hello ${i}`,
      })
    }
    await db.drain()
  }, 'c')
  console.log(toxps(N, ctime), 'c/s')

  const arr = Array.from({ length: N2 })
  let res = undefined
  const qtime = await perf(async () => {
    res = (
      await Promise.all(
        arr.map(() =>
          db.query('test').filter('x', '=', 0).range(1, 10_001).get(),
        ),
      )
    ).reduce((prev, cur) => prev + cur.length, 0)
  }, 'q')
  assert(res === N)
  console.log(toxps(N2, qtime), 'q/s')

  const s = new Sema(512)
  const qtime1 = await perf(async () => {
    await Promise.all(
      Array.from({ length: N3 }).map(async (_, i) => {
        await s.acquire()
        db.query('test', i + 1)
          .get()
          .then(() => s.release())
      }),
    )
    await s.drain()
    //res = (
    //  await Promise.all(
    //    Array.from({ length: N3 }).map((_, i) => db.query('test', i + 1).get()),
    //  )
    //).reduce((prev, cur) => prev + cur.length, 0)
  }, 'q1')
  console.log(toxps(N3, qtime1), 'q/s')

  assert(toxpsNum(N, ctime) > 1_000_000)
  assert(toxpsNum(N2, qtime) > 500)
  assert(toxpsNum(N3, qtime1) > 50_000)
})

await test('test client-server', async (t) => {
  const {
    clients: [client1],
  } = await startMulti(t)

  await client1.setSchema(schema)

  const ctime = await perf(async () => {
    let i = N
    while (i--) {
      client1.create('test', {
        x: i % 100,
        s: `hello ${i}`,
      })
    }

    await client1.drain()
  }, 'c')
  console.log(toxps(N, ctime), 'c/s')

  const arr = Array.from({ length: N2 })

  let res = undefined
  const qtime = await perf(async () => {
    res = (
      await Promise.all(
        arr.map(() =>
          client1.query('test').filter('x', '=', 0).range(1, 10_001).get(),
        ),
      )
    ).reduce((prev, cur) => prev + cur.length, 0)
  }, 'q')
  assert(res === 1_0000_000)
  console.log(toxps(N2, qtime), 'q/s')

  const qtime1 = await perf(async () => {
    res = (
      await Promise.all(
        Array.from({ length: N3 }).map((_, i) =>
          client1.query('test', i + 1).get(),
        ),
      )
    ).reduce((prev, cur) => prev + cur.length, 0)
  }, 'q1')
  console.log(toxps(N3, qtime1), 'q/s')

  assert(toxpsNum(N, ctime) > 1_000_000)
  assert(toxpsNum(N2, qtime) > 500)
  assert(toxpsNum(N3, qtime1) > 30_000)
})
