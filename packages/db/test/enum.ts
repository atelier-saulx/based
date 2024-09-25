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

  db.drain()

  const result = db.query('user').include('fancyness').get()

  console.log(result.toObject())

  deepEqual(result.toObject(), [
    { id: 1, fancyness: 'mid' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: undefined },
  ])
})
