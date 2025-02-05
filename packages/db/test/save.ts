import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
    },
  })

  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo'
  })

  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo'
  })

  await db.drain()
  await db.save()
  const db2 = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db2.destroy()
  })

  await db2.start()

  deepEqual(await db2.query('user').get().toObject(), await db.query('user').get().toObject())

})
