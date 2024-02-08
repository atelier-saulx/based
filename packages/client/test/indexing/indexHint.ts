import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import {
  SelvaFindResultType,
  SelvaTraversal,
} from '../../src/protocol/index.js'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import { find } from '../assertions/utils.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from '../assertions/index.js'

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
      SELVA_INDEX_MAX: '100',
      SELVA_INDEX_INTERVAL: '1000',
      SELVA_INDEX_ICB_UPDATE_INTERVAL: '500',
      SELVA_INDEX_POPULARITY_AVE_PERIOD: '3',
      SELVA_INDEX_THRESHOLD: '0',
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
    translations: [/* 'en_us', 'en_uk',*/ 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          strValue: { type: 'string' },
          description: { type: 'text' },
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

test('create and destroy an index', async (t) => {
  const { client } = t.context
  const q: Parameters<typeof find>[0] = {
    client,
    id: 'root',
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    index_hints: '"value" g #20 I',
    res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
    res_opt_str: 'strValue',
    rpn: ['"value" g #10 I'],
  }
  const expected = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const lsIdx = async () =>
    (await client.command('index.list'))
      .map((v, i: number) => (i % 2 === 0 ? v : v[3]))[0]
      .map((v, i: number) => (i % 2 == 1 ? v[3] : v))

  for (let i = 0; i < 100; i++) {
    await client.set({
      type: 'match',
      title: { en: 'a', de: 'b', nl: 'c' },
      value: i,
      strValue: `${i}`,
    })
  }

  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      expected
    )
  }
  await wait(2e3)
  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      expected
    )
  }

  t.deepEqual(await lsIdx(), ['root.J.InZhbHVlIiBnICMyMCBJ', 20])

  await client.command('index.del', ['root.J.InZhbHVlIiBnICMyMCBJ'])
  t.deepEqual(await lsIdx(), [])

  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      expected
    )
  }
  await wait(2e3)
  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      expected
    )
  }

  t.deepEqual(await lsIdx(), ['root.J.InZhbHVlIiBnICMyMCBJ', 20])

  await client.command('index.del', ['root.J.InZhbHVlIiBnICMyMCBJ', 1])
  t.deepEqual(await lsIdx(), ['root.J.InZhbHVlIiBnICMyMCBJ', 'not_active'])
})

test('add and delete nodes in an index', async (t) => {
  await wait(15e3)
  const { client } = t.context
  const q: Parameters<typeof find>[0] = {
    client,
    id: 'root',
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    index_hints: '"value" g #80 H',
    res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
    res_opt_str: 'strValue',
    rpn: ['"value" g #90 I'],
  }

  const ids = await Promise.all(
    [
      {
        type: 'match',
        title: { en: 'a', de: 'b', nl: 'c' },
        value: 81,
        strValue: '81',
      },
      {
        type: 'match',
        title: { en: 'a', de: 'b', nl: 'c' },
        value: 82,
        strValue: '82',
      },
      {
        type: 'match',
        title: { en: 'a', de: 'b', nl: 'c' },
        value: 93,
        strValue: '93',
      },
    ].map((v) => client.set(v))
  )

  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      ['81', '82']
    )
  }
  await wait(2e3)
  for (let i = 0; i < 500; i++) {
    const r = (await find(q))[0]
    deepEqualIgnoreOrder(
      t,
      r.map((v) => v[1][1]),
      ['81', '82']
    )
  }

  await client.set({
    type: 'match',
    value: 84,
    strValue: '84',
  })

  const r1 = (await find(q))[0]
  deepEqualIgnoreOrder(
    t,
    r1.map((v) => v[1][1]),
    ['81', '82', '84']
  )

  await client.delete({ $id: ids[1] })

  const r2 = (await find(q))[0]
  deepEqualIgnoreOrder(
    t,
    r2.map((v) => v[1][1]),
    ['81', '84']
  )
})

// TODO This test is wayy too slow. Could it be made MUCH faster??
test.skip('create max number of indices', async (t) => {
  const { client } = t.context

  const getQ: () => Parameters<typeof find>[0] = () => ({
    client,
    id: 'root',
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    index_hints: Array.from({ length: 15 }, (_, i: number) => [
      'index',
      `"value" g #${Math.floor(Math.random() * 100 + i)} I`,
    ])
      .flat()
      .join('\0'),
    res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
    res_opt_str: 'strValue',
    rpn: ['"value" g #10 I'],
  })

  for (let i = 0; i < 800; i++) {
    await client.set({
      type: 'match',
      title: { en: 'a', de: 'b', nl: 'c' },
      value: i,
      strValue: `${i}`,
    })
  }

  for (let j = 0; j < 100; j++) {
    console.time('batch')
    const q = getQ()
    for (let i = 0; i < 500; i++) {
      await find(q)
    }
    await wait(2e3)
    console.timeEnd('batch')
  }

  t.pass()
})
