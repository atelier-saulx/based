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

  // bla
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

  const id = 750e3

  const close = db.query('user', id).subscribe((q) => {
    console.log(q.id, q)
  })

  //   const interval = setInterval(() => {
  //   }, 100)

  await wait(100)
  update()
  await wait(100)
  update()
  await wait(300)

  console.log('derp')
  await db.update('user', id, {
    nr: (await db.query('user', id).include('nr').get().toObject()).nr,
  })
  await wait(100)

  close()
})
