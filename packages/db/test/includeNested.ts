import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('include */**', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
          friends: { items: { ref: 'user', prop: 'friends' } },
        },
      },
    },
  })

  db.create('user', { nr: 2, friends: [db.create('user', { nr: 1 })] })
  db.create('user', { nr: 3 })

  deepEqual(await db.query('user').include('**').range(0, 5).get().toObject(), [
    {
      id: 1,
      friends: [
        {
          id: 2,
          nr: 2,
        },
      ],
    },
    {
      id: 2,
      friends: [
        {
          id: 1,
          nr: 1,
        },
      ],
    },
    {
      id: 3,
      friends: [],
    },
  ])
})
