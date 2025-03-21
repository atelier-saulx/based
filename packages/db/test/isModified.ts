import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('isModified', async (t) => {
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
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', { nr: i })
  }

  deepEqual((await db.query('user').range(0, 5).get()).toObject(), [
    { id: 1, nr: 0 },
    { id: 2, nr: 1 },
    { id: 3, nr: 2 },
    { id: 4, nr: 3 },
    { id: 5, nr: 4 },
  ])
})
