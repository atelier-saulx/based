import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { SelvaTraversal } from '../src/protocol'

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
    root: {
      fields: {},
    },
    types: {
      thing: {
        prefix: 'th',
        fields: {
          str: { type: 'string' },
          flap: { type: 'boolean' },
        },
      },
      notthing: {
        prefix: 'nh',
        fields: {
          str: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test('basic batch update', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'thing',
    str: 'something',
    children: [
      {
        type: 'thing',
        str: 'something',
      },
      {
        type: 'notthing',
        str: 'something',
      },
      {
        type: 'thing',
        str: 'something',
      },
    ],
  })

  await client.command('update', [
    {
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
    },
    [{ type: '0', field: 'str', value: 'hello' }],
    [id],
    '"th" e',
  ])
  t.deepEqual(
    await client.get({
      $id: id,
      rest: {
        $list: {
          $find: {
            $traverse: 'descendants',
          },
          $sort: { $field: 'type' },
        },
        type: true,
        str: true,
      },
    }),
    {
      rest: [
        { type: 'notthing', str: 'something' },
        { type: 'thing', str: 'hello' },
        { type: 'thing', str: 'hello' },
      ],
    }
  )
})

test('single node updates', async (t) => {
  const { client } = t.context

  const th1 = await client.set({
    type: 'thing',
    str: 'unchanged',
    flap: true,
  })
  const th2 = await client.set({
    type: 'thing',
    str: 'unchanged',
    flap: false,
  })

  await client.command('update', [
    {
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
    },
    [{ type: '0', field: 'str', value: 'changed' }],
    [th1, th2],
    '$1 g',
    ['flap'],
  ])
  t.deepEqual(
    await client.get({
      $id: th1,
      str: true,
    }),
    {
      str: 'changed',
    }
  )
  t.deepEqual(
    await client.get({
      $id: th2,
      str: true,
    }),
    {
      str: 'unchanged',
    }
  )
})

// TODO Move to subs
//test('subscription and batch update', async (t) => {
//  const { client } = t.context
//  t.plan(3)
//
//  const id = await client.set({
//    type: 'thing',
//    str: 'something',
//    children: [
//      {
//        type: 'thing',
//        str: 'something',
//      },
//      {
//        type: 'notthing',
//        str: 'something',
//      },
//      {
//        type: 'thing',
//        str: 'something',
//      },
//    ],
//  })
//
//  const obs = client.observe({
//    items: {
//      type: true,
//      str: true,
//      $list: {
//        $find: {
//          $traverse: 'descendants',
//          $filter: [
//            {
//              $field: 'type',
//              $operator: '=',
//              $value: 'thing',
//            },
//          ],
//        },
//      },
//    },
//  })
//
//  let i = 0
//  const sub = obs.subscribe((e) => {
//    switch (i++) {
//      case 0:
//        t.deepEqual(e, {
//          items: [
//            { type: 'thing', str: 'something' },
//            { type: 'thing', str: 'something' },
//            { type: 'thing', str: 'something' },
//          ],
//        })
//        break
//      case 1:
//        t.deepEqual(e, {
//          items: [
//            { type: 'thing', str: 'hello' },
//            { type: 'thing', str: 'hello' },
//            { type: 'thing', str: 'hello' },
//          ],
//        })
//        break
//      default:
//        t.fail()
//    }
//  })
//  await wait(100)
//
//  await client.redis.selva_update(
//    '___selva_hierarchy',
//    'descendants',
//    '1',
//    '0',
//    'str',
//    'hello',
//    <string>id,
//    '"th" e'
//  )
//  t.deepEqual(
//    await client.get({
//      all: {
//        $list: {
//          $find: {
//            $traverse: 'descendants',
//          },
//          $sort: { $field: 'type', $order: 'asc' },
//        },
//        type: true,
//        str: true,
//      },
//    }),
//    {
//      all: [
//        { type: 'notthing', str: 'something' },
//        { type: 'thing', str: 'hello' },
//        { type: 'thing', str: 'hello' },
//        { type: 'thing', str: 'hello' },
//      ],
//    }
//  )
//
//  await wait(100)
//  sub.unsubscribe()
//})

test.skip('update refs not supported', async (t) => {
  const { client } = t.context

  await client.set({ type: 'notthing' })
  await client.set({
    $id: 'root',
    children: [{ type: 'thing' }, { type: 'thing' }],
  })

  // TODO
  //await t.throwsAsync(() => client.update(
  //  {
  //    type: 'thing',
  //    parents: [id1],
  //  },
  //  {
  //    $find: {
  //      $traverse: 'descendants',
  //      $filter: {
  //        $operator: '=',
  //        $value: 'thing',
  //        $field: 'type',
  //      },
  //    },
  //  }
  //))
})

// TODO Not supported yet
//test.skip('update batch - api wrapper', async (t) => {
//  const { client } = t.context
//
//  const id = await client.set({
//    type: 'thing',
//    str: 'blurgh',
//  })
//
//  for (let i = 0; i < 10; i++) {
//    client.set({
//      $id: id,
//      children: [
//        {
//          type: 'thing',
//          flap: false,
//          name: 'bla ' + i,
//        },
//      ],
//    })
//  }
//
//  await client.update(
//    {
//      type: 'thing',
//      str: 'bla',
//      flap: true,
//    },
//    {
//      $find: {
//        $traverse: 'children',
//        $filter: {
//          $operator: '=',
//          $value: 'thing',
//          $field: 'type',
//        },
//      },
//    }
//  )
//
//  const x = await client.get({
//    children: {
//      flap: true,
//      str: true,
//      $list: true,
//    },
//  })
//
//  for (const thing of x.children) {
//    if (!thing.flap && thing.str !== 'bla') {
//      t.fail('all things need a flap and str')
//    }
//  }
//
//  await client.update(
//    {
//      type: 'thing',
//      name: 'BLA',
//      parents: {
//        $add: 'root',
//        $delete: id,
//      },
//    },
//    {
//      $id: id,
//      $find: {
//        $traverse: 'children',
//        $filter: {
//          $operator: '=',
//          $value: 'thing',
//          $field: 'type',
//        },
//      },
//    }
//  )
//
//  const x2 = await client.get({
//    $id: id,
//    children: {
//      flap: true,
//      str: true,
//      $list: true,
//    },
//  })
//
//  t.deepEqual(x2.children, [])
//
//  // const x3 = await client.get({
//  //   descendants: {
//  //     name: true,
//  //     flap: true,
//  //     str: true,
//  //     parents: true,
//  //     $list: true,
//  //   },
//  // })
//
//  // console.log(JSON.stringify(x3, null, 2))
//
//  t.pass('good!')
//})
