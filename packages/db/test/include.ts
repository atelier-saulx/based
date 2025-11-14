import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'
import { deepEqual, equal } from './shared/assert.ts'

await test('include ', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
          friends: {
            items: { ref: 'user', prop: 'friends', $rating: 'number' },
          },
        },
      },
    },
  })

  db.create('user', {
    nr: 2,
    friends: [{ id: db.create('user', { nr: 1 }), $rating: 1 }],
  })
  db.create('user', { nr: 3 })

  deepEqual(
    await db.query('user').include([]).range(0, 5).get(),
    [
      {
        id: 1,
      },
      {
        id: 2,
      },
      {
        id: 3,
      },
    ],
    'empty array should return no fields',
  )

  equal((await db.query('user', 1).get()).id, 1)
  //equal((await db.query('user', 1).get()).queryId, 3978712180)
  equal((await db.query('user').get()).checksum, 2149520223)
  equal((await db.query('user').get()).version, 4507870634704934)
})

await test('main', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          a: { type: 'string', maxBytes: 10 },
          b: 'uint8',
          c: 'number',
          d: 'uint32',
        },
      },
    },
  })

  db.create('user', {
    a: 'Derp!',
    b: 250,
    c: 10,
    d: 32,
  })

  deepEqual(
    await db.query('user').range(0, 5).get(),
    [{ id: 1, c: 10, d: 32, a: 'Derp!', b: 250 }],
    'should return correct fields',
  )
})
