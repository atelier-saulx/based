import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src'
import { startOrigin } from '../../../server/dist'
import { SelvaServer } from '../../../server/dist/server'
import { SelvaResultOrder, SelvaTraversal } from '../../src/protocol'
import { wait } from '@saulx/utils'
import '../assertions'
import { getIndexingState } from '../assertions/utils'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from '../assertions'

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
      FIND_INDICES_MAX: '100',
      FIND_INDEXING_INTERVAL: '1000',
      FIND_INDEXING_ICB_UPDATE_INTERVAL: '500',
      FIND_INDEXING_POPULARITY_AVE_PERIOD: '3',
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

test.skip('find index', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'league',
    name: 'league 1',
  })
  await client.set({
    type: 'league',
    name: 'league 2',
    thing: 'yes some value here',
  })

  const q = {
    $id: 'root',
    id: true,
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
            {
              $field: 'thing',
              $operator: 'exists',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 500; i++) {
    deepEqualIgnoreOrder(t, await client.get(q), {
      id: 'root',
      items: [{ name: 'league 2' }],
    })
  }

  const indState1 = await getIndexingState(client)
  t.deepEqual(indState1['root.J.ImxlIiBl'].card, 'not_active')
  t.deepEqual(indState1['root.J.InRoaW5nIiBo'], 'not_active')

  await wait(1e3)

  const indState2 = await getIndexingState(client)
  t.deepEqual(indState2['root.J.ImxlIiBl'].card, 'not_active')
  t.deepEqual(indState2['root.J.InRoaW5nIiBo'], 'not_active')

  for (let i = 0; i < 1000; i++) {
    await client.set({
      type: 'league',
      name: 'league 2',
      thing: 'yes some value here',
    })
  }
  for (let i = 0; i < 2000; i++) {
    await client.set({
      type: 'league',
      name: 'league 3',
    })
  }

  for (let i = 0; i < 500; i++) {
    await client.get(q)
  }
  await wait(1e3)
  for (let i = 0; i < 500; i++) {
    await client.get(q)
  }

  const istate = await getIndexingState(client)
  t.truthy(istate['root.J.ImxlIiBl'])
  t.truthy(
    istate['root.J.ImxlIiBl'].take_max_ave > 140,
    `act: ${istate['root.J.ImxlIiBl'].take_max_ave}`
  )
  t.truthy(
    istate['root.J.ImxlIiBl'].tot_max_ave > 400,
    `act: ${istate['root.J.ImxlIiBl'].tot_max_ave}`
  )
  t.truthy(
    istate['root.J.ImxlIiBl'].ind_take_max_ave < 1,
    `act: ${istate['root.J.ImxlIiBl'].ind_take_max_ave}`
  )
  t.truthy(
    istate['root.J.ImxlIiBl'].card === '3002',
    `act: ${istate['root.J.ImxlIiBl'].card}`
  )
  t.truthy(istate['root.J.InRoaW5nIiBo'])
  t.truthy(
    istate['root.J.InRoaW5nIiBo'].take_max_ave > 150,
    `act: ${istate['root.J.InRoaW5nIiBo'].take_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBo'].tot_max_ave > 400,
    `act: ${istate['root.J.InRoaW5nIiBo'].tot_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBo'].ind_take_max_ave > 700,
    `act: ${istate['root.J.InRoaW5nIiBo'].ind_take_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBo'].card === '1001',
    `act: ${istate['root.J.InRoaW5nIiBo'].card}`
  )
})

test.skip('find index strings', async (t) => {
  const { client } = t.context

  for (let i = 0; i < 10000; i++) {
    const le = {
      type: 'league',
      name: `league ${i % 3}`,
      thing: 'yeeeesssshhh',
    }

    if (i % 2 === 0) {
      // @ts-ignore
      delete le.thing
    }

    await client.set(le)
  }

  await client.command('index.new', [
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    '',
    SelvaResultOrder.SELVA_RESULT_ORDER_NONE,
    '',
    'root',
    '"name" f "league 0" c',
  ])
  await wait(2e3)
  for (let i = 0; i < 500; i++) {
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'name',
                $operator: '=',
                $value: 'league 0',
              },
              {
                $field: 'thing',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    })
  }

  const ilist = (await client.command('index.list'))[0]
  t.deepEqual(ilist[0], 'root.J.Im5hbWUiIGYgImxlYWd1ZSAwIiBj')
  t.truthy(ilist[1][0] > 80, `act: ${ilist[1][0]}`)
  t.truthy(ilist[1][1] > 80, `act: ${ilist[1][1]}`)
  t.truthy(ilist[1][2] > 1300, `act: ${ilist[1][2]}`)
  t.truthy(ilist[1][3] > 3000, `act: ${ilist[1][2]}`)
})

test.skip('find index string sets', async (t) => {
  const { client } = t.context

  for (let i = 0; i < 1000; i++) {
    await client.set({
      type: 'league',
      name: `League ${i}`,
      thing: 'abc',
      things:
        i % 100 !== 0
          ? [
              'a',
              'b',
              'c',
              'd',
              'e',
              'f',
              'h',
              'i',
              'j',
              'k',
              'l',
              'm',
              'n',
              'o',
              'p',
            ]
          : [
              'a',
              'b',
              'c',
              'd',
              'e',
              'f',
              'g',
              'h',
              'i',
              'j',
              'k',
              'l',
              'm',
              'n',
              'o',
              'p',
            ],
    })
  }

  await client.command('index.new', [
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    '',
    SelvaResultOrder.SELVA_RESULT_ORDER_NONE,
    '',
    'root',
    '"g" "things" a',
  ])
  await client.command('index.new', [
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    '',
    SelvaResultOrder.SELVA_RESULT_ORDER_NONE,
    '',
    'root',
    '"thing" f "abc" c',
  ])
  await wait(1e3)
  for (let i = 0; i < 500; i++) {
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'things',
                $operator: 'has',
                $value: 'g',
              },
            ],
          },
        },
      },
    })
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'things',
                $operator: 'has',
                $value: 'g',
              },
              {
                $field: 'thing',
                $operator: '=',
                $value: 'abc',
              },
            ],
          },
        },
      },
    })
  }
  await wait(1e3)

  const istate = await getIndexingState(client)
  t.truthy(istate['root.J.ImciICJ0aGluZ3MiIGE='])
  t.truthy(
    istate['root.J.ImciICJ0aGluZ3MiIGE='].take_max_ave > 80,
    `act: ${istate['root.J.ImciICJ0aGluZ3MiIGE='].take_max_ave}`
  )
  t.truthy(
    istate['root.J.ImciICJ0aGluZ3MiIGE='].tot_max_ave > 80,
    `act: ${istate['root.J.ImciICJ0aGluZ3MiIGE='].tot_max_ave}`
  )
  t.truthy(
    istate['root.J.ImciICJ0aGluZ3MiIGE='].ind_take_max_ave > 10,
    `act: ${istate['root.J.ImciICJ0aGluZ3MiIGE='].ind_take_max_ave}`
  )
  t.truthy(
    istate['root.J.ImciICJ0aGluZ3MiIGE='].card === '10',
    `act: ${istate['root.J.ImciICJ0aGluZ3MiIGE='].card}`
  )
  t.truthy(istate['root.J.InRoaW5nIiBmICJhYmMiIGM='])
  t.truthy(
    istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].take_max_ave > 80,
    `act: ${istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].take_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].tot_max_ave > 80,
    `act: ${istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].tot_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].ind_take_max_ave > 5,
    `act: ${istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].ind_take_max_ave}`
  )
  t.truthy(
    istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].card === '1000',
    `act: ${istate['root.J.InRoaW5nIiBmICJhYmMiIGM='].card}`
  )
})

test.skip('find index integers', async (t) => {
  const { client } = t.context

  for (let i = 0; i < 1000; i++) {
    await client.set({
      type: 'league',
      name: `League ${i}`,
      cat: i % 10,
    })
  }

  const q = async () =>
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        cat: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'cat',
                $operator: '=',
                $value: 3,
              },
            ],
          },
        },
      },
    })

  for (let i = 0; i < 500; i++) {
    await q()
  }
  await wait(1e3)
  for (let i = 0; i < 500; i++) {
    await q()
  }

  const ilist = (await client.command('index.list'))[0]
  t.deepEqual(ilist[0], 'root.J.ImNhdCIgZyAjMyBG')
  t.truthy(ilist[1][0] > 10, `act: ${ilist[1][0]}`)
  t.truthy(ilist[1][1] > 100, `act: ${ilist[1][1]}`)
  t.truthy(ilist[1][2] > 10, `act: ${ilist[1][2]}`)
  t.truthy(ilist[1][3] > 90, `act: ${ilist[1][2]}`)
})

test.skip('find index exists', async (t) => {
  const { client } = t.context

  for (let i = 0; i < 1000; i++) {
    const o = {
      type: 'league',
      name: `League ${i}`,
      thing: 'abc',
      things: ['a', 'b'],
    }
    if (i % 2) {
      // @ts-ignore
      delete o.thing
    } else {
      // @ts-ignore
      delete o.things
    }
    await client.set(o)
  }

  const q1 = async () =>
    client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'thing',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    })
  const q2 = async () =>
    client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'things',
                $operator: 'notExists',
              },
            ],
          },
        },
      },
    })

  for (let i = 0; i < 500; i++) {
    await q1()
  }
  for (let i = 0; i < 500; i++) {
    await q2()
  }
  await wait(2e3)
  for (let i = 0; i < 500; i++) {
    await q1()
  }
  for (let i = 0; i < 500; i++) {
    await q2()
  }
  await wait(1e3)

  const ilist = (await client.command('index.list'))[0]
  t.deepEqual(ilist[0], 'root.J.InRoaW5nIiBo')
  t.truthy(ilist[1][0] > 50, `act: ${ilist[1][0]}`)
  t.truthy(ilist[1][1] > 100, `act: ${ilist[1][1]}`)
  t.truthy(ilist[1][2] > 100, `act: ${ilist[1][2]}`)
  t.truthy(ilist[1][3] > 490, `act: ${ilist[1][2]}`)
  t.deepEqual(ilist[2], 'root.J.InRoaW5ncyIgaCBM', `${ilist[2]}`)
  t.truthy(ilist[3][0] > 70, `act: ${ilist[3][0]}`)
  t.truthy(ilist[3][1] > 150, `act: ${ilist[3][1]}`)
  t.truthy(ilist[3][2] > 120, `act: ${ilist[3][2]}`)
  t.truthy(ilist[3][3] > 490, `act: ${ilist[3][2]}`)
})
