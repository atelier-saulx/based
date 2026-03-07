import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test('isModified', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', { nr: i })
  }

  const q: any = []

  for (let i = 0; i < 10; i++) {
    q.push(db.query('user').range(0, 5).get())
  }

  const r = await Promise.all(q)

  for (const result of r) {
    deepEqual(result, [
      { id: 1, nr: 0 },
      { id: 2, nr: 1 },
      { id: 3, nr: 2 },
      { id: 4, nr: 3 },
      { id: 5, nr: 4 },
    ])
  }
})
