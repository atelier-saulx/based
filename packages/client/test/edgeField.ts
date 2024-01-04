import anyTest, { TestFn } from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { find } from './assertions/utils'
import { SelvaTraversal } from '../src/protocol'
import { deepEqualIgnoreOrder } from './assertions'

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
    translations: ['de', 'nl'],
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

  deepEqualIgnoreOrder(
    t,
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
