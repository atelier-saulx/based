import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal, isSorted } from './shared/assert.js'

const schema = {
  types: {
    user: {
      name: 'string',
      derp: 'number',
      friends: {
        items: {
          ref: 'user',
          prop: 'friends',
        },
      },
    },
  },
} as const

// import { Schema} f

// type Schema = typeof schema

await test('sort by id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema(schema)

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: `user ${i}`,
      derp: i,
    })
  }

  const dbTime = await db.drain()

  isSorted(
    await db.query('user').include('name').sort('id', 'asc').get(),
    'id',
    'asc',
  )

  isSorted(
    await db.query('user').include('name').sort('id', 'desc').get(),
    'id',
    'desc',
  )

  for (let i = 1; i <= 10; i++) {
    await db.update('user', i, {
      friends: [1e6 - i * 10 - 2, 1e6 - i * 10 - 1],
    })
  }

  await db
    .query('user')
    .include('name', 'friends.name')
    .range(0, 1)
    .get()
    .inspect()
})
