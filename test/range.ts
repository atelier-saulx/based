import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { deepEqual, equal } from './shared/assert.js'

await test('range', async (t) => {
  const db = await testDb(t, {
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

  deepEqual(await db.query('user').include('nr').range(1, 2).get(), [
    { id: 2, nr: 2 },
  ])
  deepEqual(
    await db.query('user').include('nr').sort('email').range(1, 2).get(),
    [{ id: 2, nr: 2 }],
  )
})

await test('default range: 1000', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          nr: 'number',
        },
      },
    },
  })

  let i = 1_000_000
  while (i--) {
    db.create('user', {
      nr: i,
    })
  }
  await db.drain()
  const res = await db.query('user').get()
  equal(res.length, 1_000)
})
