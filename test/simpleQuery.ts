import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { deepEqual } from './shared/assert.js'

await test('query', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          age: { type: 'uint32' },
          name: { type: 'string' },
          countryCode: { type: 'string', maxBytes: 2 },
          location: {
            props: {
              long: { type: 'number', min: 0, max: 100 },
              lat: { type: 'number', min: 0, max: 100 },
            },
          },
        },
      },
    },
  })

  db.create('user', {
    age: 50,
    name: 'mr X',
    countryCode: 'us',
    location: {
      long: 50.123,
      lat: 51.213123,
    },
  })

  await db.drain()

  deepEqual(await db.query('user').include('id').get(), [{ id: 1 }], 'Id only')

  deepEqual(
    await db.query('user').filter('age', '<', 20).include('id', 'age').get(),
    [],
  )

  deepEqual(
    await db.query('user').include('*').get(),
    await db.query('user').get(),
    'include * works as "get all fields"',
  )
})
