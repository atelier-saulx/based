import { basicTest, deepEqualIgnoreOrder } from './assertions/index.js'
import { subscribe } from '../src/index.js'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  translations: ['de', 'nl'],
  types: {
    thing: {
      prefix: 'th',
      fields: {
        yesh: { type: 'number' },
        next: { type: 'reference' },
        things: { type: 'references' },
      },
    },
  },
})

test('subscribe and delete', async (t) => {
  const client = t.context.client

  const q: any[] = []
  for (let i = 0; i < 10; i++) {
    q.push(
      client.set({
        type: 'thing',
        yesh: i,
      })
    )
  }

  const ids = await Promise.all(q)

  let cnt = 0
  subscribe(
    client,
    {
      $id: 'root',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (_d: any) => {
      cnt++
    }
  )

  await wait(1000)

  await client.set({ type: 'thing', yesh: 2 })

  await wait(1000)

  await client.delete({ $id: ids[0] })

  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})

test('subscribe and delete a descendant', async (t) => {
  const client = t.context.client

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    children: [
      {
        type: 'thing',
        $id: 'th2',
        yesh: 2,
      },
    ],
  })

  t.plan(2)
  let i = 0

  subscribe(
    client,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      switch (i++) {
        case 0:
          t.deepEqual(v, { items: [{ id: 'th2' }] })
          break
        case 1:
          t.deepEqual(v, { items: [] })
          break
      }
    }
  )

  await wait(500)
  await client.delete({ $id: 'th2' })
  await wait(500)
})

test('subscribe and delete over a reference field', async (t) => {
  const client = t.context.client

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    next: {
      type: 'thing',
      $id: 'th2',
      yesh: 2,
    },
  })

  t.plan(2)
  let i = 0
  subscribe(
    client,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'next',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      switch (i++) {
        case 0:
          t.deepEqual(v, { items: [{ id: 'th2' }] })
          break
        case 1:
          t.deepEqual(v, { items: [] })
          break
      }
    }
  )

  await wait(500)
  await client.delete({ $id: 'th2' })
  await wait(500)
})

test('subscribe and delete over references field', async (t) => {
  const client = t.context.client

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    things: [
      {
        type: 'thing',
        $id: 'th2',
        yesh: 2,
      },
      {
        type: 'thing',
        $id: 'th3',
        yesh: 3,
      },
    ],
  })

  t.plan(2)
  let i = 0
  subscribe(
    client,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'things',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      switch (i++) {
        case 0:
          deepEqualIgnoreOrder(t, v, { items: [{ id: 'th2' }, { id: 'th3' }] })
          break
        case 1:
          t.deepEqual(v, { items: [{ id: 'th3' }] })
          break
      }
    }
  )

  await wait(500)
  await client.delete({ $id: 'th2' })
  await wait(500)
})

test('subscribe and delete one item', async (t) => {
  const client = t.context.client
  let cnt = 0
  subscribe(
    client,
    {
      $id: 'thing1',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (_d: any) => {
      cnt++ // 1
    }
  )

  await wait(1000)

  await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )

  const id = (await client.set({
    type: 'thing',
    yesh: 12,
    parents: ['thing1'],
  })) as string // 2
  await wait(1000)
  await client.delete({ $id: id }) // 3
  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})

test('subscribe and delete one item: root', async (t) => {
  const client = t.context.client
  let cnt = 0
  subscribe(
    client,
    {
      $id: 'root',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (_d: any) => {
      cnt++ // 1
    }
  )

  await wait(1000)

  const id = (await client.set({
    type: 'thing',
    yesh: 12,
  })) as string // 2
  await wait(1000)
  await client.delete({ $id: id }) // 3
  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})
