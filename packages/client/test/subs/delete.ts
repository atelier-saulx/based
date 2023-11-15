import anyTest, { TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
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
}

test.serial('subscribe and delete', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (d) => {
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

test.serial('subscribe and delete a descendant', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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

  observe(
    t,
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
    (v) => {
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

test.serial('subscribe and delete over a reference field', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (v) => {
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

  await wait(100)
  await client.delete({ $id: 'th2' })
  await wait(100)
})

test.serial('subscribe and delete over references field', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (v) => {
      switch (i++) {
        case 0:
          t.deepEqualIgnoreOrder(v, { items: [{ id: 'th2' }, { id: 'th3' }] })
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

test.serial('subscribe and delete one item', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient
  let cnt = 0
  observe(
    t,
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
    (d) => {
      console.log('dddd', d)
      cnt++ // 1
    }
  )

  await wait(1000)

  let subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  console.dir({ subs }, { depth: 8 })
  console.dir({ cache: client.CMD_SUB_MARKER_MAPPING_CACHE })

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

test.serial('subscribe and delete one item: root', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient
  let cnt = 0
  observe(
    t,
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
    (d) => {
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
