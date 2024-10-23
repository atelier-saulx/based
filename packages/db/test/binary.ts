import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e4,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })

  db.create('user', {
    file: new Uint8Array([1, 2, 3, 4]),
  })

  db.drain()

  deepEqual(db.query('user').get().toObject(), [
    {
      name: new Uint8Array([1, 2, 3, 4]),
    },
  ])
})
