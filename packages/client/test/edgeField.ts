import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'
import { find } from './assertions/utils'
import { SelvaTraversal } from '../src/protocol'

let srv: SelvaServer
let client: BasedDbClient
let port: number
test.beforeEach(async (_t) => {
  port = await getPort()
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
        a: {
          type: 'object',
          properties: {
            b: { type: 'references' },
          },
        },
        o: {
          type: 'object',
          properties: {
            a: { type: 'string' },
          },
        },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
          o: {
            type: 'object',
            properties: {
              a: { type: 'string' },
            },
          },
          a: {
            type: 'object',
            properties: {
              b: { type: 'references' },
            },
          },
          refs: {
            type: 'references',
          },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('basic edge ops', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma2',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma3',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma4',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  await client.set({
    $id: 'ma2',
    a: {
      b: ['ma1', 'ma3'],
    },
  })
  await client.set({
    $id: 'ma3',
    refs: ['ma4'],
  })
  await client.set({
    $id: 'ma4',
    refs: ['ma2'],
  })

  t.deepEqual((await client.command('hierarchy.edgeList', ['ma1']))[0], [])
  t.deepEqual((await client.command('hierarchy.edgeList', ['ma2']))[0], [
    'a',
    ['b', ['ma1', 'ma3']],
  ])
  t.deepEqual((await client.command('hierarchy.edgeList', ['ma2', 'a']))[0], [
    'b',
    ['ma1', 'ma3'],
  ])

  t.deepEqual(
    (await client.command('hierarchy.edgeGet', ['ma2', 'a']))[0],
    null
  )

  t.deepEqual((await client.command('hierarchy.edgeGet', ['ma2', 'a.b']))[0], [
    0n,
    'ma1',
    'ma3',
  ])

  t.deepEqual((await client.command('hierarchy.edgeGet', ['ma3', 'refs']))[0], [
    0n,
    'ma4',
  ])

  // Delete ma3
  await client.command('hierarchy.del', ['', 'ma3'])

  t.deepEqual((await client.command('hierarchy.edgeGet', ['ma2', 'a.b']))[0], [
    0n,
    'ma1',
  ])

  t.deepEqual((await client.command('hierarchy.edgeGet', ['ma4', 'refs']))[0], [
    0n,
    'ma2',
  ])
})

// TODO: waiting for set metadata command
test.serial.skip('edge metadata', async (t) => {
  // Create nodes
  // await client.redis.selva_modify('root', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma1', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma2', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma3', '', '0', 'o.a', 'hello')
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma2',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma3',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma4',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  // const res = await client.redis.selva_modify('ma1', '',
  //   '5', 'a.b', createRecord(setRecordDefCstring, {
  //     op_set_type: 1,
  //     delete_all: 0,
  //     constraint_id: 0,
  //     $add: joinIds(['ma2', 'ma3']),
  //     $delete: null,
  //     $value: null,
  // }),
  // 'G', 'a.b', createRecord(edgeMetaDef, {
  //   op_code: 2,
  //   delete_all: 0,
  //   dst_node_id: 'ma2',
  //   meta_field_name: 'name',
  //   meta_field_value: 'Funny edge',
  // }))
  await client.set({
    $id: 'ma1',
    a: {
      b: ['ma2', 'ma3'],
    },
  })
  // t.deepEqual(res, [ 'ma1', 'UPDATED', 'UPDATED' ])
  //
  // t.deepEqual(await client.redis.selva_hierarchy_edgegetmetadata('___selva_hierarchy', 'ma1', 'a.b', 'ma2'), [ 'name', 'Funny edge' ])
  // t.deepEqual(await client.redis.selva_hierarchy_edgegetmetadata('___selva_hierarchy', 'ma1', 'a.b', 'ma3'), null)
  //
  // await client.redis.selva_modify('ma1', '',
  // 'G', 'a.b', createRecord(edgeMetaDef, {
  //   op_code: 4,
  //   delete_all: 0,
  //   dst_node_id: 'ma2',
  //   meta_field_name: 'value',
  //   meta_field_value: Buffer.from([0x1, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]),
  // }))
  //
  // t.deepEqual(await client.redis.selva_hierarchy_edgegetmetadata('___selva_hierarchy', 'ma1', 'a.b', 'ma2'),
  //   [
  //     'name', 'Funny edge',
  //     'value', Buffer.from([0x1, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]),
  //   ])
})

test.serial('traverse a custom field', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma2',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma3',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma4',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })
  await client.set({
    $id: 'ma1',
    a: {
      b: ['ma3'],
    },
  })
  await client.set({
    $id: 'ma2',
    a: {
      b: ['ma4'],
    },
  })

  t.deepEqual(
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD,
        dir_opt_str: 'a.b',
        id: 'root',
      })
    )[0],
    ['root', 'ma1', 'ma2', 'ma3', 'ma4']
  )
})

test.serial('find can return edge fields', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma2',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma3',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma4',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })
  await client.set({
    $id: 'ma1',
    a: {
      b: ['ma3'],
    },
  })
  await client.set({
    $id: 'ma2',
    a: {
      b: ['ma4'],
    },
  })

  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'a.b\nparents',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD,
        dir_opt_str: 'a.b',
        id: 'root',
      })
    )[0],
    [
      ['root', ['a.b', ['ma1', 'ma2'], 'parents', []]],
      ['ma1', ['a.b', ['ma3'], 'parents', ['root']]],
      ['ma2', ['a.b', ['ma4'], 'parents', ['root']]],
      ['ma3', ['parents', ['root']]],
      ['ma4', ['parents', ['root']]],
    ]
  )
})

test.serial('find can do nested traversals', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma01',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma02',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma11',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma12',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma21',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma22',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  await client.set({
    $id: 'root',
    a: {
      b: ['ma01', 'ma02'],
    },
  })
  await client.set({
    $id: 'ma01',
    children: ['ma11'],
  })
  await client.set({
    $id: 'ma02',
    children: ['ma12'],
  })
  await client.set({
    $id: 'ma11',
    children: ['ma21'],
  })
  await client.set({
    $id: 'ma12',
    children: ['ma22'],
  })

  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'a.b\nparents\ndescendants',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD,
        dir_opt_str: 'a.b',
        id: 'root',
      })
    )[0],
    [
      [
        'root',
        [
          'a.b',
          ['ma01', 'ma02'],
          'parents',
          [],
          'descendants',
          ['ma01', 'ma02', 'ma11', 'ma12', 'ma21', 'ma22'],
        ],
      ],
      ['ma01', ['parents', ['root'], 'descendants', ['ma11', 'ma21']]],
      ['ma02', ['parents', ['root'], 'descendants', ['ma12', 'ma22']]],
    ]
  )
})

// TODO: waiting for set metadata command
test.serial.skip('find can select with edge metadata', async (t) => {
  // Create nodes
  // await client.redis.selva_modify('root', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma1', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma2', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma3', '', '0', 'o.a', 'hello')
  // await client.redis.selva_modify('ma4', '', '0', 'o.a', 'hello')
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma2',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma3',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'ma4',
    o: {
      a: 'hello',
    },
  })

  // Create edges
  // await client.redis.selva_modify('ma1', '',
  //   '5', 'a.b', createRecord(setRecordDefCstring, {
  //     op_set_type: 1,
  //     delete_all: 0,
  //     constraint_id: 0,
  //     $add: joinIds(['ma2', 'ma3', 'ma4']),
  //     $delete: null,
  //     $value: null,
  //   }),
  //   'G', 'a.b', createRecord(edgeMetaDef, {
  //     op_code: 4,
  //     delete_all: 0,
  //     dst_node_id: 'ma3',
  //     meta_field_name: 'key',
  //     meta_field_value: Buffer.from([0x39, 0x05, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]),
  //   })
  // )

  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find('', '___selva_hierarchy', 'expression', '{"a.b"}', 'edge_filter', '"key" g #1337 F', 'fields', 'id', 'ma1'),
  //   [
  //     [
  //       'ma3', [ 'id', 'ma3' ]
  //     ],
  //   ]
  // )
  //
  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find('', '___selva_hierarchy', 'bfs_expression', '{"a.b"}', 'edge_filter', '"key" g #1337 F', 'fields', 'id', 'ma1'),
  //   [
  //     [
  //       'ma3', [ 'id', 'ma3' ]
  //     ],
  //   ]
  // )
})

test.serial('missing edges are added automatically', async (t) => {
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })

  t.deepEqual(
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD,
        dir_opt_str: 'a.b',
        id: 'root',
      })
    )[0],
    ['root', 'ma1', 'ma2']
  )
})

test.serial('edge modify `add` values diff', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    a: {
      b: { $add: ['ma1', 'ma2'] },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
  await client.set({
    $id: 'root',
    a: {
      b: { $add: ['ma1', 'ma2'] },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
})

test.serial('edge modify `delete` values diff', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  // const rec2 = createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 0,
  //   $add: null,
  //   $delete: joinIds(['ma1', 'ma2']),
  //   $value: null,
  // })

  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
  // t.deepEqual(
  //   await client.redis.selva_modify('root', '', '5', 'a.b', rec2),
  //   ['root', 'UPDATED']
  // )
  await client.set({
    $id: 'root',
    a: {
      b: { $delete: true },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
  ])
  await client.set({
    $id: 'root',
    a: {
      b: { $delete: true },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
  ])
})

test.serial('edge modify `value` values diff', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
  await client.set({
    $id: 'root',
    a: {
      b: ['ma1', 'ma2'],
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
})

test.serial('edge modify `add` and `delete` values diff', async (t) => {
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    a: {
      b: ['ma1'],
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
  ])
  await client.set({
    $id: 'root',
    a: {
      b: { $add: ['ma2', 'ma3'], $remove: ['ma1'] },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma2',
    'ma3',
  ])
  await client.set({
    $id: 'root',
    a: {
      b: { $add: ['ma2', 'ma3'], $remove: ['ma1'] },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma2',
    'ma3',
  ])

  t.deepEqual((await client.command('hierarchy.del', ['', 'ma1']))[0], 1n)
})

test.serial('edge modify `delete_all`', async (t) => {
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    a: {
      b: { $add: ['ma1', 'ma2'] },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
    'ma1',
    'ma2',
  ])
  await client.set({
    $id: 'root',
    a: {
      b: { $delete: true },
    },
  })
  t.deepEqual((await client.command('hierarchy.edgeGet', ['root', 'a.b']))[0], [
    0n,
  ])
})
