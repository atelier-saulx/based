import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { deepEqual, equal } from '../shared/assert.js'

await test('1M', async (t) => {
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
          email: { type: 'string' },
          age: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: 'mr z',
      age: 1 + i,
      email: i + '@z.z',
    })
  }

  const dbTime = await db.drain()
  equal(dbTime < 1000, true, 'db modify should not take longer then 1s')

  let d = Date.now()
  let siTime = Date.now() - d
  equal(
    siTime < 500,
    true,
    'creating string sort index should not take longer then 500ms',
  )

  const r = await db
    .query('user')
    .include('age', 'name', 'email')
    .range(0, 1e5)
    .sort('email')
    .filter('age', '>', 1e6 - 1e5)
    .get()

  deepEqual(
    r.node(0),
    {
      id: 900001,
      age: 900001,
      name: 'mr z',
      email: '900000@z.z',
    },
    'first node is correct',
  )

  d = Date.now()
  siTime = Date.now() - d
  equal(
    siTime < 250,
    true,
    `creating string sort index should not take longer then 250s (${siTime})`,
  )
})
