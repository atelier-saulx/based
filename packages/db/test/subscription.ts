import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'

await test('subscription filter / multiple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  const amount = 1e6

  const update = () => {
    const x = Date.now()
    for (let i = 1; i < amount; i++) {
      db.update('user', i, { nr: ~~(Math.random() * 9999) })
    }
    console.log('Exec 1m', Date.now() - x, 'ms')
    db.drain()
  }

  for (let i = 1; i < amount; i++) {
    db.create('user', { nr: i })
  }
  db.drain()

  const close = db
    .query('user')
    .range(0, 1e6)
    .subscribe((q) => {
      console.log(q.id, q)
    })

  await wait(100)
  update()
  await wait(100)
  update()
  await wait(300)

  close()
})

await test('subscription id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
          x: 'uint32',
          flap: 'string',
          location: {
            props: {
              long: 'number',
              lat: 'number',
              name: 'string',
            },
          },
        },
      },
    },
  })

  const amount = 2e6
  const execString = 'update ' + amount / 1e6 + 'm'

  let cnt = 0

  const update = () => {
    const x = Date.now()
    cnt++
    for (let i = 1; i < amount; i++) {
      db.update('user', i, { nr: cnt + i })
    }
    console.log(execString, Date.now() - x, 'ms')
    db.drain()
  }

  const updateNonSubscribed = () => {
    const x = Date.now()
    cnt++
    for (let i = 1; i < amount; i++) {
      db.update('user', i, { x: cnt + i })
    }
    console.log('non subscribed ' + execString, Date.now() - x, 'ms')
    db.drain()
  }

  for (let i = 1; i < amount; i++) {
    db.create('user', { nr: i })
  }
  db.drain()

  const id = 750e3

  console.log('without subs')
  update()
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  updateNonSubscribed()
  await wait(100)
  updateNonSubscribed()
  console.log('------------- sub started------------')

  const close = db
    .query('user', id)
    .include('nr', 'location.name', 'location.long')
    .subscribe((q) => {
      console.log('Sub fires!')
    })

  await wait(100)
  await db.update('user', id, {
    location: {
      name: 'kanaalstraat 102a',
    },
  })
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  update()
  await wait(100)
  updateNonSubscribed()
  await wait(100)
  updateNonSubscribed()
  await wait(300)
  await db.update('user', id, {
    nr: (await db.query('user', id).include('nr', 'location').get().toObject())
      .nr,
  })
  await wait(100)

  const bla = Buffer.allocUnsafe(10)
  const bla2 = {}
  const bla3 = new Map()

  for (let i = 0; i < 10; i++) {
    bla[i] = i % 2 ? 1 : 0
    bla2[i] = i % 2 ? 1 : 0
    bla3.set(i, i % 2 ? 1 : 0)
  }

  let x = Date.now()
  let c = 0
  for (let i = 0; i < 3e6; i++) {
    if (bla[i % 10]) {
      bla2[i]
      // derp!
      c++
    }
  }
  console.log(c, Date.now() - x, 'ms')

  x = Date.now()
  for (let i = 0; i < 3e6; i++) {
    if (bla2[i % 10]) {
      c++
    }
  }
  console.log(c, Date.now() - x, 'ms')

  x = Date.now()
  for (let i = 0; i < 3e6; i++) {
    if (bla3.has(i % 10)) {
      c++
    }
  }
  console.log(c, Date.now() - x, 'ms')

  close()
})
