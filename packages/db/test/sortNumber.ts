import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('increment', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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
})
