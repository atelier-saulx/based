import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  await db.drain()

  deepEqual(
    (await db.query('user').include('id').get()).toObject(),
    [{ id: 1 }],
    'Id only',
  )

  deepEqual(
    (
      await db.query('user').filter('age', '<', 20).include('id', 'age').get()
    ).toObject(),
    [],
  )

  deepEqual(
    (await db.query('user').include('*').get()).toObject(),
    (await db.query('user').get()).toObject(),
    'include * works as "get all fields"',
  )
})
