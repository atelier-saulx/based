import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('delete', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      nurp: {
        props: {
          email: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const simple = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.drain()

  db.delete('user', simple)

  await db.drain()

  deepEqual((await db.query('user').get()).toObject(), [])

  const nurp = db.create('nurp', {})

  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  db.delete('nurp', nurp)

  await db.drain()

  deepEqual((await db.query('user').include('email').get()).toObject(), [])

  const nurp2 = db.create('nurp', { email: 'flippie' })

  await db.drain()

  db.update('nurp', nurp2, {
    email: null,
  })

  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 2,
    },
  ])
})
