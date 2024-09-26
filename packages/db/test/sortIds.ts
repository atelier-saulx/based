import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { isSorted } from './shared/assert.js'

await test('ids', async (t) => {
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
          email: 'string',
          age: 'timestamp',
          flap: 'uint32',
          blurf: 'number',
          bla: [0, 1, 2, 3, 4, 5],
        },
      },
    },
  })

  const ids: number[] = []
  for (let i = 0; i < 1e5; i++) {
    ids.push(
      db.create('user', {
        age: ~~(Math.random() * 100000),
        name: 'Mr Dinkelburry ' + i,
        email: 'blap@blap.blap.blap',
        flap: i,
        blurf: Math.random() * 10000,
        bla: ~~(Math.random() * 5),
      }).tmpId,
    )
  }

  db.drain()

  isSorted(db.query('user', ids).sort('age').get(), 'age')

  isSorted(db.query('user', ids).sort('name').get(), 'name')

  isSorted(db.query('user', ids).sort('flap').get(), 'flap')

  isSorted(db.query('user', ids).sort('blurf').get(), 'blurf')

  isSorted(db.query('user', ids).sort('bla').get(), 'bla')
})
