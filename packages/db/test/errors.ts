import { BasedDb } from '../src/index.js'
import { equal, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('handle errors - references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  await db.create('user', {
    friends: [2],
  })

  equal(await db.query('user').include('friends').get(), [
    {
      id: 1,
      friends: [],
    },
  ])
})

await test('handle errors - single ref', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        friend: {
          ref: 'user',
          prop: 'friend',
        },
      },
    },
  })

  await db.create('user', {
    friend: 2,
  })

  equal(await db.query('user').include('friend').get(), [
    {
      id: 1,
      friend: null,
    },
  ])
})

await test('handle errors - non existent id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  db.create('user', { name: 'bob' })
  const wrong = db.update('user', 99, { name: 'bill' })
  db.create('user', { name: 'bert' })

  await db.drain()

  equal(await db.query('user').get(), [
    { id: 1, name: 'bob' },
    { id: 2, name: 'bert' },
  ])

  throws(async () => {
    console.log('-->', await wrong)
  })
})
