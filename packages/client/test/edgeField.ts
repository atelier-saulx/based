import anyTest, { TestInterface } from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'
import { find } from './assertions/utils'
import { SelvaTraversal } from '../src/protocol'

const test = anyTest as TestInterface<{
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
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
        name: { type: 'string' },
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
        c: { type: 'references' },
        d: { type: 'references' },
        o: {
          type: 'object',
          properties: {
            a: { type: 'string' },
          },
        },
        teams: { type: 'references' },
        best: { type: 'references' },
        thing: { type: 'reference' },
        things: { type: 'references' },
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
          ref: {
            type: 'reference',
          },
          ding: { type: 'string' },
          dong: { type: 'string' },
          thing: {
            type: 'object',
            properties: {
              ding: { type: 'string' },
            },
          },
        },
      },
      game: {
        prefix: 'ga',
        fields: {
          title: { type: 'string' },
          homeTeam: { type: 'references' },
        },
      },
      player: {
        prefix: 'pl',
        fields: {
          name: { type: 'string' },
          o: {
            type: 'object',
            properties: {
              a: { type: 'string' },
            },
          },
          team: {
            type: 'reference',
            bidirectional: {
              fromField: 'players',
            },
          },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
          club: { type: 'references' },
          o: {
            type: 'object',
            properties: {
              a: { type: 'string' },
            },
          },
          players: {
            type: 'references',
            bidirectional: {
              fromField: 'team',
            },
          },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          name: { type: 'string' },
          manager: { type: 'references' },
        },
      },
      manager: {
        prefix: 'mn',
        fields: {
          name: { type: 'string' },
        },
      },
      somethingDa: {
        prefix: 'da',
        fields: {
          name: { type: 'string' },
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

test('basic edge ops', async (t) => {
  const { client } = t.context
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
test.skip('edge metadata', async (t) => {
  const { client } = t.context
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

test('traverse a custom field', async (t) => {
  const { client } = t.context
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

test('find can return edge fields', async (t) => {
  const { client } = t.context
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

test('find can do nested traversals', async (t) => {
  const { client } = t.context
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
test.skip('find can select with edge metadata', async (t) => {
  const { client } = t.context
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

test('missing edges are added automatically', async (t) => {
  const { client } = t.context
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

test('edge modify `add` values diff', async (t) => {
  const { client } = t.context
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

test('edge modify `delete` values diff', async (t) => {
  const { client } = t.context
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
  await client.set({
    $id: 'root',
    a: {
      b: { $delete: true },
    },
  })
})

test('edge modify `value` values diff', async (t) => {
  const { client } = t.context
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

test('edge modify `add` and `delete` values diff', async (t) => {
  const { client } = t.context
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

test('traverse by expression', async (t) => {
  const { client } = t.context
  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })

  await client.set({
    $id: 'root',
    c: { $add: ['ma1'] },
  })
  await client.set({
    $id: 'root',
    d: { $add: ['ma2'] },
  })

  t.deepEqualIgnoreOrder(
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION,
        dir_opt_str: '{"c","d"}',
        id: 'root',
      })
    )[0],
    ['ma1', 'ma2']
  )
})

test('deref node references on find', async (t) => {
  const { client } = t.context
  // Create nodes
  await client.set({
    $id: 'game1',
    title: 'Best Game',
  })
  await client.set({
    $id: 'team1',
    name: 'Funny Team',
  })
  await client.set({
    $id: 'club1',
    name: 'Funny Club',
  })
  await client.set({
    $id: 'mnager1',
    name: 'dung',
  })
  await client.set({
    $id: 'game1',
    homeTeam: { $add: ['team1'] },
  })
  await client.set({
    $id: 'team1',
    club: { $add: ['club1'] },
  })
  await client.set({
    $id: 'club1',
    manager: { $add: ['mnager1'] },
  })

  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str:
          'title\nhomeTeam.name\nhomeTeam.club.name\nhomeTeam.club.manager.name',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'game1',
      })
    )[0],
    [
      [
        'game1',
        [
          'title',
          'Best Game',
          'homeTeam',
          [['id', 'team1', 'name', 'Funny Team']],
          'homeTeam',
          [['id', 'team1', 'club', [['id', 'club1', 'name', 'Funny Club']]]],
          'homeTeam',
          [
            [
              'id',
              'team1',
              'club',
              [['id', 'club1', 'manager', [['id', 'mnager1', 'name', 'dung']]]],
            ],
          ],
        ],
      ],
    ]
  )
})

test('bidirectional edge fields', async (t) => {
  const { client } = t.context
  // Create dynamic constraints
  await client.command('hierarchy.addConstraint', [
    'te',
    'B',
    'players',
    'team',
  ])
  await client.command('hierarchy.addConstraint', [
    'pl',
    'SB',
    'team',
    'players',
  ])

  // Create nodes
  await client.set({
    $id: 'root',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'te1',
    o: {
      a: 'hello',
    },
  })
  await client.set({
    $id: 'pl1',
    o: {
      a: 'tim',
    },
  })
  await client.set({
    $id: 'pl2',
    o: {
      a: 'bob',
    },
  })
  await client.set({
    $id: 'pl3',
    o: {
      a: 'jack',
    },
  })

  // Create edges
  await client.set({
    $id: 'root',
    teams: { $add: ['te1'] },
  })
  await client.set({
    $id: 'te1',
    players: ['pl1', 'pl2', 'pl3'],
  })

  t.deepEqual((await client.command('hierarchy.edgeList', ['te1']))[0], [
    'players',
    ['pl1', 'pl2', 'pl3'],
  ])
  t.log(
    await client.get({
      $id: 'pl1',
      team: true,
    })
  )
  t.deepEqual((await client.command('hierarchy.edgeList', ['pl1']))[0], [
    'team',
    ['te1'],
  ])

  // Delete an edge
  await client.set({
    $id: 'pl3',
    team: { $delete: true },
  })
  t.deepEqual((await client.command('hierarchy.edgeList', ['te1']))[0], [
    'players',
    ['pl1', 'pl2'],
  ])

  // Delete an edge
  await client.set({
    $id: 'pl2',
    team: { $delete: true },
  })
  t.deepEqual((await client.command('hierarchy.edgeList', ['te1']))[0], [
    'players',
    ['pl1'],
  ])
})

// TODO: Tony, what should this be testing?
test.skip('biedge missing symmetric constraint', async (t) => {
  const { client } = t.context
  // Create dynamic constraints
  // await client.redis.selva_hierarchy_addconstraint('___selva_hierarchy',
  //     'te',
  //     'B',
  //     'players',
  //     'team',
  // )
  await client.command('hierarchy.addConstraint', [
    'te',
    'B',
    'players',
    'team',
  ])

  // Create nodes
  // await client.redis.selva_modify('root', '', '0', 'o.a', 'root')
  await client.set({
    $id: 'root',
    o: {
      a: 'root',
    },
  })
  // await client.redis.selva_modify('te1', '', '0', 'o.a', 'dun')
  await client.set({
    $id: 'te1',
    o: {
      a: 'dun',
    },
  })
  // await client.redis.selva_modify('pl1', '', '0', 'o.a', 'dan')
  await client.set({
    $id: 'pl1',
    o: {
      a: 'dan',
    },
  })

  // const res = await client.redis.selva_modify('te1', '', '5', 'players', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: joinIds(['pl1']),
  //   $delete: null,
  //   $value: null,
  // }))
  const res = await client.set({
    $id: 'te1',
    players: { $add: ['pl1'] },
  })
  t.log({ res })
  // t.true(res[1] instanceof Error)
})

test('edge type constraints', async (t) => {
  const { client } = t.context
  // Create dynamic constraints
  // await client.redis.selva_hierarchy_addconstraint('___selva_hierarchy',
  //     'ro', // source node type
  //     'S', // constraint flags
  //     'best', // source field name
  //     '', // bck field name
  // )
  await client.command('hierarchy.addConstraint', [
    'ro', // source node type
    'S', // constraint flags
    'best', // source field name
    '', // bck field name
  ])
  // await client.redis.selva_hierarchy_addconstraint('___selva_hierarchy',
  //     'ro', // source node type
  //     '', // constraint flags
  //     'teams', // source field name
  //     '', // bck field name
  // )
  await client.command('hierarchy.addConstraint', [
    'ro', // source node type
    '', // constraint flags
    'teams', // source field name
    '', // bck field name
  ])
  // await client.redis.selva_hierarchy_addconstraint('___selva_hierarchy',
  //     'te',
  //     'B',
  //     'players',
  //     'team',
  // )
  await client.command('hierarchy.addConstraint', [
    'te',
    'B',
    'players',
    'team',
  ])
  // await client.redis.selva_hierarchy_addconstraint('___selva_hierarchy',
  //     'pl',
  //     'B',
  //     'team',
  //     'players',
  // )
  await client.command('hierarchy.addConstraint', [
    'pl',
    'B',
    'team',
    'players',
  ])

  // // Create nodes
  // await client.redis.selva_modify('root', '', '0', 'o.a', 'root')
  await client.set({
    $id: 'root',
    o: {
      a: 'root',
    },
  })
  // await client.redis.selva_modify('te1', '', '0', 'o.a', 'dun')
  await client.set({
    $id: 'te1',
    o: {
      a: 'dun',
    },
  })
  // await client.redis.selva_modify('pl1', '', '0', 'o.a', 'dan')
  await client.set({
    $id: 'pl1',
    o: {
      a: 'dan',
    },
  })
  // await client.redis.selva_modify('pl2', '', '0', 'o.a', 'dandan')
  await client.set({
    $id: 'pl2',
    o: {
      a: 'dandan',
    },
  })
  // await client.redis.selva_modify('in1', '', '0', 'o.a', 'dandan')
  // await client.set({
  //   $id: 'in1',
  //   o: {
  //     a: 'dandan',
  //   },
  // })

  let res

  // PASS
  await t.notThrowsAsync(
    client.set({
      $id: 'root',
      teams: { $add: ['te1'] },
    })
  )

  // // PASS
  // res = await client.redis.selva_modify('root', '', '5', 'best', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: null,
  //   $delete: null,
  //   $value: joinIds(['te1']),
  // }))
  // t.deepEqual(res[1], 'UPDATED')
  await t.notThrowsAsync(
    client.set({
      $id: 'root',
      best: ['te1'],
    })
  )

  // TODO: Tony, don't know what to test here?
  // I can't make it fail

  // FAIL
  // res = await client.redis.selva_modify('te1', '', '5', 'players', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: joinIds(['root']),
  //   $delete: null,
  //   $value: null,
  // }))
  // t.true(res[1] instanceof Error)

  // PASS
  // res = await client.redis.selva_modify('te1', '', '5', 'players', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: joinIds(['pl1']),
  //   $delete: null,
  //   $value: null,
  // }))
  // t.deepEqual(res[1], 'UPDATED')
  await t.notThrowsAsync(
    client.set({
      $id: 'te1',
      players: { $add: ['pl1'] },
    })
  )

  // TODO: Tony, don't know what to test here?

  // FAIL
  // res = await client.redis.selva_modify('pl2', '', '5', 'team', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: joinIds(['root']),
  //   $delete: null,
  //   $value: null,
  // }))
  // t.true(res[1] instanceof Error)
  // PASS
  // res = await client.redis.selva_modify('pl2', '', '5', 'team', createRecord(setRecordDefCstring, {
  //   op_set_type: 1,
  //   delete_all: 0,
  //   constraint_id: 2,
  //   $add: joinIds(['te1']),
  //   $delete: null,
  //   $value: null,
  // }))
  // t.deepEqual(res[1], 'UPDATED')
  await t.notThrowsAsync(
    client.set({
      $id: 'pl2',
      team: 'te1',
    })
  )
})

test('wildcard find with edge fields', async (t) => {
  const { client } = t.context
  // Create nodes
  await client.set({
    $id: 'root',
    name: 'hello',
  })
  await client.set({
    $id: 'ma1',
    ding: 'dong',
    dong: 'ding',
  })
  await client.set({
    $id: 'ma2',
    ding: 'dong',
    dong: 'ding',
  })

  await client.set({
    $id: 'root',
    thing: 'ma1',
  })
  await client.set({
    $id: 'root',
    things: { $add: ['ma1', 'ma2'] },
  })
  //
  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'thing.ding',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'root',
      })
    )[0],
    [['root', ['thing', [['id', 'ma1', 'ding', 'dong']]]]]
  )
  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'thing.*\n!thing.createdAt\n!thing.updatedAt',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'root',
      })
    )[0],
    [
      [
        'root',
        [
          'thing',
          [
            [
              'id',
              'ma1',
              'ding',
              'dong',
              'dong',
              'ding',
              'id',
              'ma1',
              'type',
              'match',
            ],
          ],
        ],
      ],
    ]
  )
  // Can't do this with multi-ref
  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'things.*\n!things.createdAt\n!things.updatedAt',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'root',
      })
    )[0],
    [
      [
        'root',
        [
          'things',
          [
            [
              'id',
              'ma1',
              'ding',
              'dong',
              'dong',
              'ding',
              'id',
              'ma1',
              'type',
              'match',
            ],
            [
              'id',
              'ma2',
              'ding',
              'dong',
              'dong',
              'ding',
              'id',
              'ma2',
              'type',
              'match',
            ],
          ],
        ],
      ],
    ]
  )
})

test('wildcard find with edge fields and data fields', async (t) => {
  const { client } = t.context
  // Create nodes
  await client.set({
    $id: 'root',
    name: 'hello',
  })
  await client.set({
    $id: 'ma1',
    thing: {
      ding: 'dong',
    },
  })
  await client.set({
    $id: 'da3',
    name: 'dong',
  })

  await client.set({
    $id: 'ma2',
    ref: 'da3',
  })

  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'thing',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'ma1',
      })
    )[0],
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'thing.*',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        id: 'ma1',
      })
    )[0]
  )
  t.deepEqual(
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str:
          'thing.*\nref.*\n!id\n!ref\n!ref.createdAt\n!ref.updatedAt\n!ref.type',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
        id: 'root',
        rpn: ['"ma" e'],
      })
    )[0],
    [
      ['ma1', ['thing', ['ding', 'dong']]],
      ['ma2', ['ref', [['id', 'da3', 'id', 'da3', 'name', 'dong']]]],
    ]
  )
})

test('wildcard find with exclusions', async (t) => {
  const { client } = t.context
  // Create nodes
  await client.set({
    $id: 'root',
    name: 'hello',
  })
  await client.set({
    $id: 'ma1',
    thing: {
      ding: 'dong',
    },
  })
  await client.set({
    $id: 'da3',
    name: 'dong',
  })

  await client.set({
    $id: 'ma2',
    ref: 'da3',
    ding: 'dong',
  })

  const r = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str:
        'thing.*\nref.*\n!id\n!ref\n!ref.createdAt\n!ref.updatedAt\n!ref.type',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"ma" e'],
    })
  )[0]
  t.deepEqual(r, [
    ['ma1', ['thing', ['ding', 'dong']]],
    ['ma2', ['ref', [['id', 'da3', 'id', 'da3', 'name', 'dong']]]],
  ])
})

test('edge meta alias', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'da1',
  })
  await client.set({
    $id: 'ma1',
    ref: {
      $id: 'da1',
      $edgeMeta: { note: 'very cool', antiNote: 'not very cool' },
    },
    description: { en: 'The most boring' },
  })

  const r1 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str:
        'expl@description.en\ncool@ref.$edgeMeta.note\nref.$edgeMeta.antiNote',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"ma" e'],
    })
  )[0]
  t.deepEqual(r1, [
    [
      'ma1',
      [
        'ref',
        [['id', 'da1', '$edgeMeta', ['antiNote', 'not very cool']]],
        'ref',
        [['id', 'da1', '$edgeMeta', ['cool@note', 'very cool']]],
        'expl@description.en',
        'The most boring',
      ],
    ],
  ])

  const r2 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'ref.$edgeMeta',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"ma" e'],
    })
  )[0]
  t.deepEqual(r2, [
    [
      'ma1',
      [
        'ref',
        [
          [
            'id',
            'da1',
            '$edgeMeta',
            ['', ['antiNote', 'not very cool', 'note', 'very cool']],
          ],
        ],
      ],
    ],
  ])

  const r3 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'cool@ref.$edgeMeta',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"ma" e'],
    })
  )[0]
  t.deepEqual(r3, [
    [
      'ma1',
      [
        'ref',
        [
          [
            'id',
            'da1',
            '$edgeMeta',
            ['cool@', ['antiNote', 'not very cool', 'note', 'very cool']],
          ],
        ],
      ],
    ],
  ])
})
