import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  // schema
  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          nr: { type: 'uint32' },
          location: {
            props: {
              address: { type: 'string' },
              location: {
                props: {
                  address: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })

  db.create('user', {
    age: 12, // first pass, inits the main and puts
    nr: 1, // second
    email: 'merp_1@once.net',
    location: {
      address: 'Derpstreet 1',
    },
  })

  db.create('user', {
    age: 99,
    nr: 2,
    email: 'merp_2@once.net',
    location: {
      address: 'Derpstreet 2',
    },
  })

  db.create('user', {
    age: 37,
    nr: 3,
    email: 'merp_3@once.net',
    location: {
      address: 'Derpstreet 3',
    },
  })

  await db.drain()

  const result = await db.query('user').include('nr').range(1, 2).get()

  deepEqual(result.toObject(), [{ id: 2, nr: 2 }])

  const result2 = await db
    .query('user')
    .include('nr')
    .sort('email')
    .range(1, 2)
    .get()

  deepEqual(result2.toObject(), [{ id: 2, nr: 2 }])
})
