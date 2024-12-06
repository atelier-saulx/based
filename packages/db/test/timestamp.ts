import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('number', async (t) => {
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
          name: 'string',
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          updatedAt: {
            type: 'timestamp',
            on: 'update',
          },
        },
      },
    },
  })

  db.create('user', {
    name: 'youzi',
  })

  db.create('user', {
    name: 'jamex',
  })

  db.drain() // will become async

  // const res = db.query('user').get().toObject()

  // deepEqual(
  //   db.query('user').get().toObject(),
  //   payloads.map((payload, index) => {
  //     return {
  //       id: index + 1,
  //       ...payload,
  //     }
  //   }),
  // )
})
