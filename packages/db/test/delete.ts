import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('delete', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

await test('non existing 1', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  // this can be handled in js
  await db.delete('nurp', 213123123)

  await db.delete('user', simple)

  // this has to be ignored in C
  await db.delete('user', simple)
})

await test('non existing 2', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  const simple = await db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.delete('user', simple)

  deepEqual((await db.query('user').get()).toObject(), [])

  const nurp = db.create('nurp', {})

  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  // this can be handled in js
  await db.delete('nurp', 213123123)

  await db.delete('user', simple)

  // this has to be ignored in C
  await db.delete('user', simple)
})

await test('save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const first = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })
  db.create('user', {
    name: 'mr slurp',
    age: 99,
    email: 'slurp@snurp.snurp',
  })

  await db.drain()
  await db.save()
  db.delete('user', first)
  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  deepEqual(await db2.query('user').include('id').get().toObject(), [{ id: 2 }])
  deepEqual(await db.query('user').include('id').get().toObject(), [{ id: 2 }])
})
