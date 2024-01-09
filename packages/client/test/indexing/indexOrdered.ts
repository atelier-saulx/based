import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import { getIndexingState } from '../assertions/utils.js'
import getPort from 'get-port'

const chars = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.context.port = await getPort()
  console.log('origin')
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
    env: {
      FIND_INDICES_MAX: '2',
      FIND_INDEXING_INTERVAL: '10',
      FIND_INDEXING_ICB_UPDATE_INTERVAL: '1',
      FIND_INDEXING_POPULARITY_AVE_PERIOD: '1',
      FIND_INDEXING_THRESHOLD: '5',
    },
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })

  console.log('updating schema')
  await t.context.client.updateSchema({
    language: 'en',
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
          things: { type: 'set', items: { type: 'string' } },
          cat: { type: 'integer' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          description: { type: 'text' },
          value: {
            type: 'number',
          },
          status: { type: 'number' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test.skip('find with sort', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'league',
    name: 'league 0',
  })
  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q = {
    $id: 'root',
    id: true,
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
            {
              $field: 'thing',
              $operator: 'exists',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q), {
      id: 'root',
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }

  t.deepEqual(
    (await client.command('index.list'))[0].map((v: any, i: any) =>
      i % 2 === 0 ? v : v[3]
    ),
    ['root.J.B.dGhpbmc=.ImxlIiBl', '36', 'root.J.B.dGhpbmc=.InRoaW5nIiBo', '35']
  )
})

test.skip('find with sort and limit', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'league',
    name: 'league 0',
  })
  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q = {
    $id: 'root',
    id: true,
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $limit: 5,
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
            {
              $field: 'thing',
              $operator: 'exists',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q), {
      id: 'root',
      items: Array(5)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }

  t.deepEqual(
    (await client.command('index.list'))[0].map((v: any, i: any) =>
      i % 2 === 0 ? v : v[3]
    ),
    ['root.J.B.dGhpbmc=.ImxlIiBl', '36', 'root.J.B.dGhpbmc=.InRoaW5nIiBo', '35']
  )
})

test.skip('pick unordered index for sorted result', async (t) => {
  const { client } = t.context

  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q1 = {
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }
  const q2 = {
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    const res = await client.get(q1)
    t.deepEqual(res?.items.length, chars.length)
    await wait(1)
  }
  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q2), {
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }

  const stateMap = await getIndexingState(client)
  t.deepEqual(stateMap['root.J.ImxlIiBl'].card, '35')
  t.deepEqual(stateMap['root.J.B.dGhpbmc=.ImxlIiBl'].card, 'not_active')
})

test.skip('pick index with wrong order for sorted result', async (t) => {
  const { client } = t.context

  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q1 = {
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }
  const q2 = {
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'desc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q1), {
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }
  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q2), {
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${chars.length - i}` })),
    })
    await wait(1)
  }

  const stateMap = await getIndexingState(client)
  t.deepEqual(stateMap['root.J.B.dGhpbmc=.ImxlIiBl'].card, '35')
  t.deepEqual(stateMap['root.J.C.dGhpbmc=.ImxlIiBl'].card, 'not_active')
})

test.skip('do not pick ordered index for unsorted result', async (t) => {
  const { client } = t.context

  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q1 = {
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }
  const q2 = {
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q1), {
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }
  for (let i = 0; i < 300; i++) {
    const res = await client.get(q2)
    t.deepEqual(res?.items.length, chars.length)
    await wait(1)
  }

  const stateMap = await getIndexingState(client)
  t.deepEqual(stateMap['root.J.B.dGhpbmc=.ImxlIiBl'].card, '35')
  t.deepEqual(stateMap['root.J.ImxlIiBl'].card, '35')
})

test.skip('change the sorted field value', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'league',
    name: 'league 0',
  })
  for (let i = 0; i < chars.length; i++) {
    await client.set({
      type: 'league',
      name: `league ${i + 1}`,
      thing: `${chars.charAt(i)}`,
    })
  }

  const q = {
    $id: 'root',
    id: true,
    items: {
      name: true,
      $list: {
        $sort: { $field: 'thing', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
            {
              $field: 'thing',
              $operator: 'exists',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    t.deepEqual(await client.get(q), {
      id: 'root',
      items: Array(chars.length)
        .fill(null)
        .map((_, i) => ({ name: `league ${i + 1}` })),
    })
    await wait(1)
  }

  t.deepEqual(
    (await client.command('index.list'))[0].map((v: any, i: any) =>
      i % 2 === 0 ? v : v[3]
    ),
    ['root.J.B.dGhpbmc=.ImxlIiBl', '36', 'root.J.B.dGhpbmc=.InRoaW5nIiBo', '35']
  )

  await Promise.all(
    (
      await client.get({
        stuff: {
          id: true,
          thing: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'thing',
                $operator: 'exists',
              },
            },
          },
        },
      })
    ).stuff.map(async (thing: any, i: number) =>
      client.set({
        $id: thing.id,
        thing: `${thing.thing}${i}`,
      })
    )
  )
  t.deepEqual(await client.get(q), {
    id: 'root',
    items: Array(chars.length)
      .fill(null)
      .map((_, i) => ({ name: `league ${i + 1}` })),
  })
})
