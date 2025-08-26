import { BasedDb } from '../src/index.js'
import { setTimeout as setTimeoutAsync } from 'timers/promises'
import test from './shared/test.js'
import { italy } from './shared/examples.js'

await test('concurrency', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  // let i = 1e6
  // while (i > 2) {
  //   db.create('user', {})
  //   i--
  // }
  // await db.drain()

  let id = 0
  let queries = 0
  let refs = []
  let timer = setTimeout(() => {
    // db.destroy()
    timer = null
  }, 5e3)

  let len = 0
  let size = 0
  let queriesParsed = 0
  const query = async () => {
    queries++
    try {
      const x = await db
        .query('user')
        .include((s) => s('friends').range(0, 10))
        .range(0, 1000_000)
        .get()
      size += x.size
      len += x.length
      queriesParsed++
    } catch (e) {
      console.error('err:', e)
    }
    queries--
  }

  while (timer) {
    let i = 100
    while (i--) {
      query()
    }
    while (timer && queries) {
      db.create('user', {
        friends: refs,
      })
      refs.push(++id)
      await db.drain()
      await setTimeoutAsync()
    }
  }

  clearTimeout(timer)

  console.log(
    `Received # of items ${len} processed ${queriesParsed} size ${size / 1e3 / 1e3}mb`,
  )
})

await test('many instances', async (t) => {
  const dbs = await Promise.all(Array.from({ length: 20 }).map(async () => {
    const db = new BasedDb({
      path: t.tmp,
    })
    await db.start({ clean: true })
    t.after(() => t.backup(db))
    return db
  }))

  await Promise.all(dbs.map(async (db) => db.setSchema({
    types: {
      t: {
        props: {
          i: 'number',
          s: { type: 'string', compression: 'deflate' },
        },
      },
    },
  })))

  const s = italy.slice(0, 1024)
  for (let i = 0; i < 10_000; i++) {
    dbs.map((db) => db.create('t', { i, s }))
  }
  await Promise.all(dbs.map((db) => db.query('t').search('contribution', 's').include('i').get()))
  await Promise.all(dbs.map((db) => db.drain()))
})
