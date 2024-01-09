import { basicTest, deepEqualIgnoreOrder } from './assertions/index.js'
import { subscribe } from '../src/index.js'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    sport: {
      prefix: 'sp',
      fields: {
        title: { type: 'text' },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        title: { type: 'text' },
        venue: { type: 'reference' },
      },
    },
    venue: {
      prefix: 've',
      fields: {
        title: { type: 'text' },
        description: { type: 'text' },
        seats: { type: 'references' },
      },
    },
    seat: {
      prefix: 'se',
      fields: {
        color: { type: 'text' },
      },
    },
  },
})

// TODO: $language with subscription is somehow off?
test.skip('subscription to a reference', async (t) => {
  const client = t.context.client
  await client.set({
    $id: 'ma1',
    $language: 'en',
    type: 'match',
    title: 'menu item',
  })
  const sport = await client.set({
    $id: 'sp1',
    $language: 'en',
    type: 'sport',
    title: 'football',
  })
  const seat1 = await client.set({
    $id: 'se1',
    $language: 'en',
    type: 'seat',
    color: 'white',
  })
  const seat2 = await client.set({
    $id: 'se2',
    $language: 'en',
    type: 'seat',
    color: 'red',
  })
  const venue = await client.set({
    $id: 've1',
    $language: 'en',
    type: 'venue',
    title: 'Ipurua Stadium',
    seats: [seat1],
  })
  const venue2 = await client.set({
    $id: 've2',
    $language: 'en',
    type: 'venue',
    title: 'Fake Ipurua Stadium',
    seats: [],
  })
  const match = await client.set({
    $id: 'ma2',
    $language: 'en',
    type: 'match',
    title: 'football match',
    parents: [sport],
  })

  let n = 0
  subscribe(
    client,
    {
      $id: match,
      $language: 'en',
      title: true,
      venue: {
        title: true,
        seats: true,
      },
    },
    (v: any) => {
      switch (n++) {
        case 0:
          deepEqualIgnoreOrder(t, v, { title: 'football match' })
          break
        case 1:
          deepEqualIgnoreOrder(t, v, {
            title: 'football match',
            venue: { title: 'Ipurua Stadium', seats: [seat1] },
          })
          break
        case 2:
          deepEqualIgnoreOrder(t, v, {
            title: 'football match',
            venue: { title: 'Ipurua Stadium', seats: [seat1, seat2] },
          })
          break
        case 3:
          t.deepEqual(v, {
            title: 'football match',
            venue: {
              seats: [],
              title: 'Fake Ipurua Stadium',
            },
          })
          break
        default:
          t.fail()
      }
    }
  )
  await wait(1e3)

  await client.set({
    $id: match,
    venue: venue,
  })
  await wait(1e3)
  await client.set({
    $id: venue,
    seats: { $add: [seat2] },
  })

  await wait(1e3)
  await client.set({
    $id: match,
    venue: venue2,
  })
  await wait(1e3)
  t.deepEqual(n, 4, 'All change events received')
})
