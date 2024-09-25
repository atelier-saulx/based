import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('enum', async (t) => {
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
          fancyness: ['mid', 'fire', 'beta'],
        },
      },
    },
  })

  db.create('user', {
    fancyness: 'mid',
  })

  db.create('user', {
    fancyness: 'fire',
  })

  db.create('user', {
    fancyness: 'beta',
  })

  db.create('user', {})

  db.drain() // will become async

  deepEqual(db.query('user').include('fancyness').get().toObject(), [
    { id: 1, fancyness: 'mid' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: undefined },
  ])

  deepEqual(
    db
      .query('user')
      .include('fancyness')
      .filter('fancyness', '=', 'fire')
      .get()
      .toObject(),
    [{ id: 2, fancyness: 'fire' }],
  )
})
