import { basicTest } from './assertions/index.js'
import { destroySubscriber, subscribe } from '../src/index.js'

const test = basicTest({
  language: 'en',
  root: {
    fields: {
      trackUniqueOrigins: {
        type: 'set',
        items: { type: 'string' },
      },
      uniqueUsers: {
        type: 'record',
        values: {
          type: 'cardinality',
        },
      },
    },
  },
})

test('record with cardinality', async (t) => {
  const client = t.context.client
  let cnt = 0

  await client.set({
    $id: 'root',
    uniqueUsers: { total: 16558146173444 },
  })

  await client.set({
    $id: 'root',
    uniqueUsers: { total: 16558146173444 },
  })

  await new Promise<void>((resolve) =>
    subscribe(
      client,
      {
        uniqueUsers: true,
      },
      ({ uniqueUsers: { total } }) => {
        if (cnt++ === 0) {
          t.is(total, 1)
          client.set({
            $id: 'root',
            uniqueUsers: { total: 333 },
          })
        } else {
          t.is(total, 2)
          resolve()
        }
      }
    )
  )
  destroySubscriber(client)
})
