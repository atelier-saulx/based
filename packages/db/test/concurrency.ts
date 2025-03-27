import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { setTimeout as setTimeoutAsync } from 'timers/promises'

await test('concurrency', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

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

  console.time('create stuff')

  let id = 0
  let queries = 0
  let refs = []
  let timer = setTimeout(() => {
    // db.destroy()
    timer = null
  }, 5e3)

  const query = async () => {
    queries++
    try {
      await db.query('user').include('friends').range(0, 1000_000).get()
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

  console.timeEnd('create stuff')
})
