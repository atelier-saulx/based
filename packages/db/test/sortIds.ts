import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('ids', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'string',
          age: 'timestamp',
          flap: 'uint32',
          blurf: 'number',
          bla: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        },
      },
    },
  })

  const ids: number[] = []
  for (let i = 0; i < 1e5; i++) {
    ids.push(
      db.create('user', {
        age: ~~(Math.random() * 1000000),
        name: 'Mr Dinkelburry ' + i,
        email: 'blap@blap.blap.blap',
        flap: i,
        blurf: Math.random() * 10000,
        bla: ~~(Math.random() * 15),
      }).tmpId,
    )
  }

  db.drain()

  console.log(db.query('user', ids).include('age').sort('age').get())

  console.log(db.query('user', ids).include('name').sort('name').get())

  console.log(db.query('user', ids).include('flap').sort('flap').get())

  console.log(db.query('user', ids).include('blurf').sort('blurf').get())

  console.log(db.query('user', ids).include('bla').sort('bla').get())
})
