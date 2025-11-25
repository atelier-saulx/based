import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { deepEqual, throws } from './shared/assert.js'

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

  const user2 = db.create('user', {
    fancyness: 'fire',
  })

  db.create('user', {
    fancyness: 'beta',
  })

  db.create('user', {})

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: 'mid' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])

  deepEqual(
    (
      await db
        .query('user')
        .include('fancyness')
        .filter('fancyness', '=', 'fire')
        .get()
    ).toObject(),
    [
      { id: 2, fancyness: 'fire' },
      { id: 4, fancyness: 'fire' },
    ],
  )

  db.update('user', user1, {
    fancyness: 'beta',
  })

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: 'beta' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])

  await db.update('user', user1, {
    fancyness: null,
  })

  throws(() =>
    db.update('user', user2, {
      fancyness: 3,
    }),
  )
  throws(() =>
    db.update('user', user2, {
      fancyness: 'fond',
    }),
  )

  deepEqual((await db.query('user').include('fancyness').get()).toObject(), [
    { id: 1, fancyness: 'fire' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])
})

await test('emoji enum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      review: {
        props: {
          score: {
            type: 'enum',
            enum: ['☹️', '😐', '🙂'],
            default: '😐',
          },
        },
      },
    },
  })

  db.create('review', {})
  db.create('review', { score: '🙂' })

  deepEqual(await db.query('review').include('score').get(), [
    {
      id: 1,
      score: '😐',
    },
    {
      id: 2,
      score: '🙂',
    },
  ])

  db.create('review', { score: '☹️' })
  db.create('review', { score: '😐' })
  deepEqual(
    await db.query('review').include('score').sort('score', 'desc').get(),
    [
      { id: 2, score: '🙂' },
      { id: 1, score: '😐' },
      { id: 4, score: '😐' },
      { id: 3, score: '☹️' },
    ],
  )
})
