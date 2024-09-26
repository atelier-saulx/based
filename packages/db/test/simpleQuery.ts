import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          age: { type: 'uint32' },
          name: { type: 'string' },
          countryCode: { type: 'string', maxBytes: 2 },
          location: {
            props: {
              long: { type: 'number', min: 0, max: 100, step: 'any' },
              lat: { type: 'number', min: 0, max: 100, step: 'any' },
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

  db.drain()

  deepEqual(
    db.query('user').include('id').get().toObject(),
    [{ id: 1 }],
    'Id only',
  )

  deepEqual(
    db
      .query('user')
      .filter('age', '<', 20)
      .include('id', 'age')
      .get()
      .toObject(),
    [],
  )
})
