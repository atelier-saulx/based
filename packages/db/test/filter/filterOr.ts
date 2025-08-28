import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('filter or', async (t) => {
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
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('user', { nr: i })
  }

  deepEqual(
    (
      await db.query('user').filter('nr', '>', 8).or('nr', '<', 1).get()
    ).toObject(),
    [
      {
        id: 1,
        nr: 0,
      },
      {
        id: 10,
        nr: 9,
      },
    ],
    'single or',
  )

  deepEqual(
    (
      await db
        .query('user')
        .filter('nr', '>', 8)
        .or((t) => {
          t.filter('nr', '<', 1).or('nr', '=', 5)
        })
        .get()
    ).toObject(),
    [
      {
        id: 1,
        nr: 0,
      },
      {
        id: 6,
        nr: 5,
      },
      {
        id: 10,
        nr: 9,
      },
    ],
    'branch fn',
  )

  deepEqual(
    (
      await db
        .query('user')
        .filter('nr', '>', 8)
        .or('nr', '<', 1)
        .or('nr', '=', 5)
        .get()
    ).toObject(),
    [
      {
        id: 1,
        nr: 0,
      },
      {
        id: 6,
        nr: 5,
      },
      {
        id: 10,
        nr: 9,
      },
    ],
    'double or',
  )

  deepEqual(
    (
      await db
        .query('user')
        .filter('nr', '>', 8)
        .or(() => {})
        .get()
    ).toObject(),
    [
      {
        id: 10,
        nr: 9,
      },
    ],
    'empty or branch',
  )
})
