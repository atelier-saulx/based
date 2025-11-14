import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'
import { deepEqual } from './shared/assert.ts'

await test('isModified', async (t) => {
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

  for (let i = 0; i < 1e6; i++) {
    db.create('user', { nr: i })
  }

  const q: any = []

  for (let i = 0; i < 10; i++) {
    q.push(db.query('user').range(0, 5).get())
  }

  const r = await Promise.all(q)

  for (const result of r) {
    deepEqual(result.toObject(), [
      { id: 1, nr: 0 },
      { id: 2, nr: 1 },
      { id: 3, nr: 2 },
      { id: 4, nr: 3 },
      { id: 5, nr: 4 },
    ])
  }
})
