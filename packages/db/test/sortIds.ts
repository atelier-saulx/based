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
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'timestamp' },
        },
      },
    },
  })

  const ids: number[] = []
  for (let i = 0; i < 500; i++) {
    ids.push(
      db.create('user', {
        age: ~~(Math.random() * 1000000),
        name: 'Mr Dinkelburry ' + i,
        email: 'blap@blap.blap.blap',
      }).tmpId,
    )
  }

  db.drain()

  console.log(db.query('user', ids).include('age').sort('age').get())
})
