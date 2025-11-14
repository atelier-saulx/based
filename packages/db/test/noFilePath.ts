import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'
import { deepEqual } from './shared/assert.ts'

await test('allow path:null for in mem only', async (t) => {
  const db = new BasedDb({
    path: null,
  })

  t.after(() => db.destroy())
  await db.start({
    clean: true,
  })
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

  deepEqual(await db.query('user').include([]).range(0, 5).get(), [
    {
      id: 1,
    },
    {
      id: 2,
    },
    {
      id: 3,
    },
  ])
})
