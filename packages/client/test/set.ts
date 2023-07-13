import test from 'ava'
import {
  BasedDbClient,
  hierarchy_find_def,
  SelvaFindResultType,
  SelvaTraversal,
  SELVA_NODE_ID_LEN,
} from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { createRecord } from 'data-record'

test.serial('set string to num field, should fail', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    languages: ['en', 'nl', 'de', 'fi'],
    $defs: {},
    prefixToTypeMapping: {
      po: 'post',
    },
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      post: {
        prefix: 'po',
        fields: {
          slug: { type: 'string' },
          num: { type: 'number' },
          tags: {
            type: 'set',
            items: { type: 'string' },
          },
        },
      },
    },
  })

  await t.throwsAsync(
    client.set({
      $id: 'po1',
      slug: '/hello-world',
      num: 'flappie',
    })
  )

  const getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  t.true(true)
})

test.serial.only('set primitive fields', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    languages: ['en', 'nl', 'de', 'fi'],
    $defs: {},
    prefixToTypeMapping: {
      po: 'post',
    },
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      post: {
        prefix: 'po',
        fields: {
          parents: { type: 'references' },
          children: { type: 'references' },
          slug: { type: 'string' },
          num: { type: 'number' },
          int: { type: 'integer' },
          bool: { type: 'boolean' },
          ts: { type: 'timestamp' },
          obj: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'string' },
            },
          },
        },
      },
    },
  })

  await client.set({
    $id: 'po1',
    slug: '/hello-world',
    num: 25.5,
    int: 112,
    ts: Date.now(),
    bool: true,
    obj: {
      a: 11,
      b: 'hello',
    },
  })

  let getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  await client.set({
    $id: 'po2',
    slug: '/second-post',
    int: 2,
    parents: ['po1'],
  })

  await client.command('object.incrby', ['po2', 'int', 3])

  getResult = await client.command('object.get', ['', 'po2', 'slug'])
  console.log('getResult', getResult)
  t.deepEqual(getResult, ['/second-post'])

  getResult = await client.command('object.get', ['', 'po2', 'int'])
  console.log('getResult', getResult)
  t.deepEqual(getResult, [BigInt(5)])

  let parents = await client.command('hierarchy.parents', ['po2'])
  console.log('PARENTS po2', parents)

  let children = await client.command('hierarchy.children', ['po1'])
  console.log('CHILDREN po1', children)

  await client.set({
    $id: 'po2',
    slug: { $delete: true },
    parents: { $add: ['root'] },
    // tags: { $delete: true }, // TODO
  })

  getResult = await client.command('object.get', ['', 'po2', 'slug'])
  t.deepEqual(getResult, [null])
  console.log('getResult', getResult)

  parents = await client.command('hierarchy.parents', ['po2'])
  console.log('PARENTS po2', parents)

  children = await client.command('hierarchy.children', ['po1'])
  console.log('CHILDREN po1', children)

  console.log(
    'ROOT CHILDREN',
    await client.command('hierarchy.children', ['root'])
  )

  const find = await client.command('hierarchy.find', [
    '',
    createRecord(hierarchy_find_def, {
      dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      res_opt_str: '*',
    }),
    'root'.padEnd(SELVA_NODE_ID_LEN, '\0'),
    '',
  ])
  console.log('FINDDDD', find)

  t.true(true)
})
