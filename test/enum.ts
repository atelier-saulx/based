import test from './shared/test.js'
import { deepEqual, throws } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test('enum', async (t) => {
  const client = await testDb(t, {
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

  const user1 = await client.create('user', {
    fancyness: 'mid',
  })

  const user2 = client.create('user', {
    fancyness: 'fire',
  })

  client.create('user', {
    fancyness: 'beta',
  })

  client.create('user', {})

  deepEqual(await client.query('user').include('fancyness').get(), [
    { id: 1, fancyness: 'mid' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])

  deepEqual(
    await client
      .query('user')
      .include('fancyness')
      .filter('fancyness', '=', 'fire')
      .get(),
    [
      { id: 2, fancyness: 'fire' },
      { id: 4, fancyness: 'fire' },
    ],
  )

  client.update('user', user1, {
    fancyness: 'beta',
  })

  deepEqual(await client.query('user').include('fancyness').get(), [
    { id: 1, fancyness: 'beta' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])

  await client.update('user', user1, {
    fancyness: null,
  })

  throws(() =>
    client.update('user', user2, {
      fancyness: 3,
    }),
  )
  throws(() =>
    client.update('user', user2, {
      fancyness: 'fond',
    }),
  )

  deepEqual(await client.query('user').include('fancyness').get(), [
    { id: 1, fancyness: 'fire' },
    { id: 2, fancyness: 'fire' },
    { id: 3, fancyness: 'beta' },
    { id: 4, fancyness: 'fire' },
  ])
})

await test('emoji enum', async (t) => {
  const client = await testDb(t, {
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

  client.create('review', {})
  client.create('review', { score: '🙂' })

  deepEqual(await client.query('review').include('score').get(), [
    {
      id: 1,
      score: '😐',
    },
    {
      id: 2,
      score: '🙂',
    },
  ])

  client.create('review', { score: '☹️' })
  client.create('review', { score: '😐' })
  deepEqual(
    await client.query('review').include('score').sort('score', 'desc').get(),
    [
      { id: 2, score: '🙂' },
      { id: 1, score: '😐' },
      { id: 4, score: '😐' },
      { id: 3, score: '☹️' },
    ],
  )
})
