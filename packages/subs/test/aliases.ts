import { basicTest, deepEqualIgnoreOrder } from './assertions/index.js'
import { wait } from '@saulx/utils'
import { destroySubscriber, subscribe } from '../src/index.js'

const test = basicTest({
  language: 'en',
  translations: ['de', 'nl'],
  root: {
    fields: { yesh: { type: 'string' }, no: { type: 'string' } },
  },
  types: {
    yeshType: {
      prefix: 'ye',
      fields: {
        yesh: { type: 'string' },
      },
    },
  },
})

test('changing alias to another node fires subscription', async (t) => {
  const client = t.context.client

  t.plan(2)

  await client.set({
    $id: 'yebba',
    yesh: 'pretty nice',
    aliases: { $add: 'hello-friend' },
  })

  let o1counter = 0
  subscribe(
    client,
    {
      $alias: 'hello-friend',
      yesh: true,
    },
    (d: any) => {
      if (o1counter === 0) {
        // gets start event
        t.is(d.yesh, 'pretty nice')
      } else if (o1counter === 1) {
        // gets update event
        deepEqualIgnoreOrder(t, d, { yesh: 'extra nice' })
      } else {
        // doesn't get any more evente
        t.fail()
      }
      o1counter++
    }
  )

  await wait(500 * 2)

  await client.set({
    $id: 'yebbe',
    yesh: 'extra nice',
    aliases: { $add: 'hello-friend' },
  })

  await wait(500 * 2)
  destroySubscriber(client)
})

test.skip('subcribing to non existing alias should not cache results', async (t) => {
  t.timeout(3000)
  const client = t.context.client

  const alias = 'hello-friend'

  // TODO: Should a "isNull" result trigger a subscribe?
  await new Promise((resolve) => {
    subscribe(
      client,
      {
        $alias: alias,
        yesh: true,
      },
      (d: any) => {
        t.is(d, {})
        resolve(true)
      }
    )
  })

  client.set({
    $id: 'yebba',
    yesh: 'pretty nice',
    aliases: { $add: 'hello-friend' },
  })

  await new Promise((resolve) => {
    subscribe(
      client,
      {
        $alias: alias,
        yesh: true,
      },
      (d: any) => {
        t.is(d.yesh, 'pretty nice')
        resolve(true)
      }
    )
  })

  await wait(500)
  destroySubscriber(client)
})
