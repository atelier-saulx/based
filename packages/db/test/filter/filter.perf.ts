import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('uint32', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        nr: 'uint32',
        flap: 'uint32',
      },
    },
  })

  for (let i = 0; i < 1e7; i++) {
    db.create('user', {
      nr: i,
    })
  }

  await db.drain()

  await db
    .query('user')
    .include('nr')
    // .filter('nr', '=', 1e7) // lets start with this...
    // .filter('flap', '=', 10) // lets start with this...
    .filter('nr', '=', [1e7, 2e7]) // lets start with this...
    // .or('nr', '=', 1e7 + 10) // lets start with this...
    // .filter('flap', '=', [20, 670]) // should give results
    .or('nr', '=', [1e7, 1e7 + 1, 1e7 + 2, 1e7 + 3]) // lets sta
    .get()
    .inspect()
})
