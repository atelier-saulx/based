import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'

await test('subscription  multiple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  const amount = 1e6

  const update = async () => {
    const x = Date.now()
    for (let i = 1; i < amount; i++) {
      db.update('user', i, { nr: ~~(Math.random() * 9999) })
    }
    console.log('Exec 1m', Date.now() - x, 'ms')
    await db.drain()
  }

  for (let i = 1; i < amount; i++) {
    db.create('user', { nr: i })
  }
  await db.drain()

  const close = db
    .query('user')
    .range(0, 1e6)
    .subscribe((q) => {
      console.log(q.id, q)
    })

  await wait(100)
  await update()
  await wait(100)
  await update()
  await wait(300)

  close()
})

await test('subscription filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          flap: 'uint32',
        },
      },
    },
  })

  const amount = 1e6

  const update = async () => {
    const x = Date.now()
    for (let i = 1; i < amount; i++) {
      db.update('user', i, { nr: ~~(Math.random() * 9999) })
    }
    console.log('Exec 1m', Date.now() - x, 'ms')
    await db.drain()
  }

  for (let i = 1; i < amount; i++) {
    db.create('user', { nr: i, name: 'Mr ' + i, flap: 666 })
  }
  await db.drain()

  const close = db
    .query('user')
    .range(0, 1e6)
    .include('name')
    .filter('flap', '=', 666)
    .filter('nr', '>', 9500)
    .filter('name', 'has', 'Mr')
    .or((f) => {
      f.filter('nr', '=', 1e9)
      f.or('nr', '>', 2e9)
    })
    .subscribe((q) => {
      console.log(q.id, q)
    })

  await wait(100)
  await update()
  await wait(100)
  await update()
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

  close()
})

await test('subscription mixed', async (t) => {
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
          name: 'string',
          nr: 'uint32',
          flap: 'uint32',
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
    db.create('user', { nr: i, name: 'Mr ' + i, flap: i })
  }
  db.drain()

  let blarf = 0

  const end = setInterval(() => {
    console.log(blarf)
  }, 100)

  for (let i = 0; i < 100e3; i++) {
    const close = db.query('user', i + 1).subscribe((q) => {
      // console.log(q.id, q)
      blarf++
    })

    // db.query('user')
    //   // .range(0, 1000)

    //   .range(0, 1)
    //   .include('name', 'nr')
    //   .filter('flap', '=', i)
    //   // .filter('nr', '>', 9500)
    //   .filter('name', 'has', 'Mr')
    //   // .or((f) => {
    //   // f.filter('nr', '=', 1e9)
    //   // f.or('nr', '>', 2e9)
    //   // })
    //   .subscribe((q) => {
    //     blarf++
    //     // console.log(q.id, q)
    //     blarf++
    //   })

    db.query('user')
      .range(0, 1000)

      .range(0, 1)
      .include('name', 'nr')
      .filter('flap', '=', i)
      // .filter('nr', '>', 9500)
      // .filter('name', 'has', 'Mr')
      // .or((f) => {
      //   f.filter('nr', '=', 1e9)
      //   f.or('nr', '>', 2e9)
      // })
      .subscribe((q) => {
        blarf++
        // console.log(q.id, q)
      })
  }
  await wait(1000)
  update()
  await wait(1000)
  update()
  await wait(1000)

  clearInterval(end)
})

test('subscription listener', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
        },
      },
    },
  })

  let lastRes
  db.query('user').subscribe((res) => {
    lastRes = res.toObject()
  })

  await wait(300)

  await db.create('user', {
    name: 'youzi',
  })

  await db.create('user', {
    name: 'james',
  })

  await wait(300)

  deepEqual(lastRes, [
    { id: 1, name: 'youzi' },
    { id: 2, name: 'james' },
  ])
})
