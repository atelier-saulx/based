import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'
import { SelvaTraversal } from '../src/protocol'
import { find } from './assertions/utils'

let srv: SelvaServer
let client: BasedDbClient
let port
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
    languages: ['en'],
    types: {
      league: {
        prefix: 'le',
        fields: {},
      },
      team: {
        prefix: 'te',
        fields: {
          value: { type: 'number' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
      thing: {
        prefix: 'th',
        fields: {
          docs: { type: 'references' },
        },
      },
      file: {
        prefix: 'tx',
        fields: {
          name: { type: 'string' },
          mirrors: { type: 'references' },
        },
      },
      mirror: {
        prefix: 'sp',
        fields: {
          url: { type: 'string' },
        },
      },
      super: {
        prefix: 'su',
        fields: {
          nested: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              ref: { type: 'reference' },
              refs: { type: 'references' },
            },
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

// TODO: Mismatch $list formats from previous version
test.serial.skip('retrieving nested refs with fields arg', async (t) => {
  for (let i = 0; i < 2; i++) {
    await client.set({
      type: 'thing',
      docs: [...Array(2)].map((_, i) => ({
        type: 'file',
        $id: `tx${i}`,
        name: `file${i}.txt`,
        mirrors: [
          {
            type: 'mirror',
            url: `http://localhost:3000/file${i}.txt`,
          },
          {
            type: 'mirror',
            url: `http://localhost:3001/file${i}.txt`,
          },
        ],
      })),
    })
  }

  const res1 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'docs.*\n!docs.createdAt\n!docs.updatedAt',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"th" e'],
    })
  )[0]
  t.deepEqualIgnoreOrder(res1[0][1], [
    'docs',
    [
      ['id', 'tx0', 'id', 'tx0', 'name', 'file0.txt', 'type', 'file'],
      ['id', 'tx1', 'id', 'tx1', 'name', 'file1.txt', 'type', 'file'],
    ],
  ])

  const res2 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'docs.name\ndocs.mirrors.url',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"th" e'],
    })
  )[0]
  t.deepEqual(res2[0][1][0], 'docs')
  t.deepEqual(res2[0][1][1], [
    ['id', 'tx0', 'name', 'file0.txt'],
    ['id', 'tx1', 'name', 'file1.txt'],
  ])
  t.deepEqual(res2[0][1][2], 'docs')
  t.truthy(res2[0][1][3][0].length === 4)
  t.deepEqual(res2[0][1][3][0][2], 'mirrors')
  t.deepEqual(res2[0][1][3][0][3][0][2], 'url')
  t.deepEqual(res2[0][1][3][1][2], 'mirrors')

  const res3 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'docs.name\ndocs.mirrors.url\n!docs.mirrors.url',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"th" e'],
    })
  )[0]
  t.deepEqualIgnoreOrder(res3[0][1], [
    'docs',
    [
      ['id', 'tx0', 'name', 'file0.txt'],
      ['id', 'tx1', 'name', 'file1.txt'],
    ],
  ])

  const res4 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: 'id\ndocs.id\ndocs.name\ndocs.mirrors.*\n!id',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"th" e'],
    })
  )[0]
  t.deepEqual(res4[0][1][0], 'id', 'id not excluded')

  const res5 = (
    await find({
      client,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str:
        'docs.id\ndocs.name\ndocs.mirrors.*\n!docs.mirrors.id\n!mirrors.url\n!docs.mirrors.createdAt\n!docs.mirrors.updatedAt',
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      id: 'root',
      rpn: ['"th" e'],
    })
  )[0]
  t.deepEqual(res5[0][1][0], 'docs')
  t.deepEqual(res5[0][1][1][0][0], 'id') // hence we have id here anyway
  t.deepEqual(res5[0][1][1][1][0], 'id')
  t.deepEqual(res5[0][1][2], 'docs')
  t.deepEqual(res5[0][1][3][0][2], 'name')
  t.deepEqual(res5[0][1][3][0][3], 'file0.txt')
  t.deepEqual(res5[0][1][3][1][2], 'name')
  t.deepEqual(res5[0][1][3][1][3], 'file1.txt')
  t.deepEqual(res5[0][1][4], 'docs')
  t.deepEqual(res5[0][1][5][0][2], 'mirrors')
  t.deepEqual(res5[0][1][5][0][3].length, 2)
  t.deepEqual(res5[0][1][5][0][3][0].length, 6)
  t.deepEqual(res5[0][1][5][0][3][1].length, 6)
  t.deepEqual(res5[1][1][0], 'docs')
  t.deepEqual(res5[1][1][1][0][0], 'id')
  t.deepEqual(res5[1][1][1][1][0], 'id')
  t.deepEqual(res5[1][1][2], 'docs')
  t.deepEqual(res5[1][1][3][0][2], 'name')
  t.deepEqual(res5[1][1][3][0][3], 'file0.txt')
  t.deepEqual(res5[1][1][3][1][2], 'name')
  t.deepEqual(res5[1][1][3][1][3], 'file1.txt')
  t.deepEqual(res5[1][1][4], 'docs')
  t.deepEqual(res5[1][1][5][0][2], 'mirrors')
  t.deepEqual(res5[1][1][5][0][3].length, 2)
  t.deepEqual(res5[1][1][5][0][3][0].length, 6)
  t.deepEqual(res5[1][1][5][0][3][1].length, 6)

  const res6 = await client.get({
    files: {
      // `name` doesn't actually exist
      docs: { mirrors: { name: true, url: true } },
      $list: {
        // TODO This doesn't seem to actually work
        // $sort: { $field: 'mirrors.url', $order: 'asc' },
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'thing',
          },
        },
      },
    },
  })
  console.log(JSON.stringify(res6, null, 2))
  t.deepEqualIgnoreOrder(res6?.files[0]?.docs.mirrors, [
    {
      url: 'http://localhost:3000/file0.txt',
    },
    {
      url: 'http://localhost:3001/file0.txt',
    },
    {
      url: 'http://localhost:3000/file1.txt',
    },
    {
      url: 'http://localhost:3001/file1.txt',
    },
  ])
  t.deepEqualIgnoreOrder(res6?.files[1]?.docs.mirrors, [
    {
      url: 'http://localhost:3000/file0.txt',
    },
    {
      url: 'http://localhost:3001/file0.txt',
    },
    {
      url: 'http://localhost:3000/file1.txt',
    },
    {
      url: 'http://localhost:3001/file1.txt',
    },
  ])
})

test.serial('retrieving nested ref from an object', async (t) => {
  const match = await client.set({
    type: 'match',
    value: 10.0,
  })
  const sup = await client.set({
    type: 'super',
    nested: {
      name: 'ref',
      ref: match,
    },
  })

  const res1 = await client.get({
    $id: sup,
    nested: {
      $all: true,
      createdAt: false,
      updatedAt: false,
      ref: { value: true },
    },
  })
  t.deepEqual(res1, {
    nested: { name: 'ref', ref: { value: 10 } },
  })

  const res2 = await client.get({
    sups: {
      nested: { ref: { value: true } },
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'super',
          },
        },
      },
    },
  })
  t.deepEqual(res2, {
    sups: [
      {
        nested: {
          ref: {
            value: 10.0,
          },
        },
      },
    ],
  })
})

// TODO: Mismatch $list formats from previous version
test.serial.skip('retrieving nested refs from an object', async (t) => {
  const match1 = await client.set({
    $id: 'ma1',
    type: 'match',
    value: 10.0,
  })
  const match2 = await client.set({
    $id: 'ma2',
    type: 'match',
    value: 20.0,
  })
  const sup = await client.set({
    type: 'super',
    nested: {
      name: 'refs',
      refs: [match1, match2],
    },
  })

  // RFE Not supported without $find
  //const res1 = await client.get({
  //  $id: sup,
  //  nested: { $all: true, refs: { value: true } },
  //})
  //t.deepEqual(
  //  res1,
  //  {
  //    nested: { name: 'ref', refs: [ { value: 10 }, { value: 20 } ] }
  //  }
  //)

  const res2 = await client.get({
    sups: {
      nested: { refs: { value: true } },
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'super',
          },
        },
      },
    },
  })
  t.deepEqual(res2, {
    sups: [
      {
        nested: {
          refs: [{ value: 10.0 }, { value: 20.0 }],
        },
      },
    ],
  })
})
