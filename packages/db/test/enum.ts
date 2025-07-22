import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('enum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          fancyness: {
            type: 'enum',
            enum: ['mid', 'fire', 'beta'],
            default: 'fire',
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {
    fancyness: 'mid',
  })

  db.create('user', {
    fancyness: 'fire',
  })

  db.create('user', {
    fancyness: 'beta',
  })

  db.create('user', {})

  await db.drain() // will become async

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: 'mid' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: undefined },
  ])

  deepEqual(
    (
      await db
        .query('user')
        .include('fancyness')
        .filter('fancyness', '=', 'fire')
        .get()
    ).toObject(),
    [{ id: 2, fancyness: 'fire' }],
  )

  db.update('user', user1, {
    fancyness: 'beta',
  })

  await db.drain()

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: 'beta' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: undefined },
  ])

  await db.update('user', user1, {
    fancyness: null,
  })

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: undefined },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: undefined },
  ])
})
