import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { createRecord } from 'data-record'
import { SelvaMergeStrategy } from '../src/protocol'

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
      me: 'meh',
    },
    root: {
      prefix: 'ro',
      fields: {
        id: { type: 'string' },
      },
    },
    types: {
      meh: {
        prefix: 'me',
        fields: {
          id: { type: 'string' },
          str: { type: 'string' },
          rec: {
            type: 'record',
            values: {
              type: 'object',
              properties: { a: { type: 'string' }, b: { type: 'number' } },
            },
          },
        },
      },
      post: {
        prefix: 'po',
        fields: {
          id: { type: 'string' },
          type: { type: 'string' },
          aliases: { type: 'set', items: { type: 'string' } },
          parents: { type: 'references' },
          children: { type: 'references' },
          slug: { type: 'string' },
          num: { type: 'number' },
          int: { type: 'integer' },
          bool: { type: 'boolean' },
          ts: { type: 'timestamp' },
          uniqs: { type: 'cardinality' },
          obj: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'string' },
            },
          },
          tags: {
            type: 'set',
            items: { type: 'string' },
          },
          arys: {
            type: 'object',
            properties: {
              ints: { type: 'array', values: { type: 'integer' } },
              floats: { type: 'array', values: { type: 'number' } },
              strs: { type: 'array', values: { type: 'string' } },
              objs: {
                type: 'array',
                values: {
                  type: 'object',
                  properties: {
                    a: { type: 'number' },
                    b: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  await client.set({
    $id: 'me1',
    str: 'hello',
    rec: {
      a: { a: 'hello', b: 1 },
      b: { a: 'olleh', b: -1 },
    },
  })

  await client.set({
    $id: 'po1',
    slug: '/hello-world',
    num: 25.5,
    int: 112,
    ts: 1690289344322,
    bool: true,
    obj: {
      a: 11,
      b: 'hello',
    },
    aliases: { $add: ['main'] },
    arys: {
      ints: [1, 2, 3, 4, 5],
      floats: [1.1, 2.2, 3.3, 4.4, 5.5],
      strs: ['a', 'b', 'c', 'def'],
      objs: [{ a: 1 }, { b: 'hello' }, { a: 2, b: 'yes' }],
    },
  })

  await client.set({
    $id: 'po1',
    arys: {
      ints: { $assign: { $idx: 1, $value: 6 } },
      floats: { $unshift: [-1.1, 0.0] },
      strs: { $push: 'gh' },
      objs: { $remove: { $idx: 2 } },
    },
  })

  let getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  await client.set({
    $id: 'po2',
    slug: '/second-post',
    int: 2,
    parents: ['po1'],
    aliases: {
      $add: ['sec'],
    },
    tags: {
      $add: ['comedy', 'action', 'horror'],
    },
    uniqs: {
      a: 1,
      b: 1,
    },
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
    $alias: 'sec',
    type: 'post',
    slug: { $delete: true },
    parents: { $add: ['root'] },
    uniqs: {
      a: 1,
      b: 2,
    },
    tags: { $remove: ['horror'] }, // TODO
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

  const third = await client.set({
    $alias: '3rd',
    type: 'post',
    slug: '/third',
    parents: ['po2'],
  })

  const find = await client.get({
    things: {
      $all: true,
      aliases: true,
      children: true,
      createdAt: false,
      updatedAt: false,
      // f: { $field: ['nonExistingField', 'parents'] }, // TODO
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'post',
          },
        },
      },
    },
  })

  t.deepEqual(find.things.length, 3)
  t.deepEqual(find, {
    things: [
      {
        aliases: ['main'],
        arys: {
          floats: [-1.1, 0, 1.1, 2.2, 3.3, 4.4, 5.5],
          ints: [1, 6, 3, 4, 5],
          objs: [{ a: 1 }, { b: 'hello' }],
          strs: ['a', 'b', 'c', 'def', 'gh'],
        },
        // f: ['root'], // TODO
        bool: true,
        id: 'po1',
        int: 112,
        num: 25.5,
        obj: { a: 11, b: 'hello' },
        slug: '/hello-world',
        ts: 1690289344322,
        children: ['po2'],
      },
      {
        aliases: ['sec'],
        id: 'po2',
        int: 5,
        tags: ['action', 'comedy'],
        uniqs: 2,
        children: [third],
      },
      { id: third, slug: '/third', children: [] },
    ],
  })

  const single = await client.get({
    $id: third,
    $all: true,
    $aliases: true,
    children: true,
    fi: { $field: ['nonExistingField', 'parents'] },
    createdAt: false,
    updatedAt: false,
  })
  console.dir({ single }, { depth: 8 })
  t.deepEqual(single, { id: third, slug: '/third', children: [], fi: ['po2'] })

  const expr = await client.get({
    traversed: {
      $fieldsByType: {
        $any: {
          id: true,
        },
        meh: {
          str: true,
          // TODO: try $field here
        },
      },
      $list: {
        $find: {
          $traverse: 'children',
          $recursive: true,
        },
      },
    },
  })
  // TODO
  t.deepEqual(expr, {
    traversed: [
      { id: 'me1', str: 'hello' },
      { id: 'po1' },
      { id: 'po2' },
      { id: third },
    ],
  })
  return

  t.deepEqual(
    (await client.command('lsaliases'))[0].sort(),
    ['main', 'po1', 'sec', 'po2'].sort()
  )

  const things = await client.get({
    $id: third,
    id: true,
    title: true,
    arys: {
      ints: true,
    },
    slug: true,

    ancestors: {
      id: true,
      title: true,
      slug: true,
      arys: {
        ints: true,
        objs: true,
      },
      aliases: true,
      $list: true,
    },

    above: {
      id: true,
      title: true,
      slug: true,
      aliases: true,
      children: true,
      below: {
        id: true,
        slug: true,
        parents: {
          id: true,
          $list: true,
        },
        $list: {
          $find: {
            $traverse: 'children',
          },
        },
      },
      $list: {
        $find: {
          $traverse: 'parents',
        },
      },
    },

    meh: {
      $id: 'me1',
      str: true,
      rec: true,
    },
  })

  t.deepEqual(things, {
    id: third,
    slug: '/third',
    meh: [
      {
        str: 'hello',
      },
    ],
    ancestors: [
      {
        id: 'po2',
        aliases: ['sec'],
      },
      {
        arys: {
          ints: [1, 6, 3, 4, 5],
          objs: [
            {
              a: 1,
            },
            {
              b: 'hello',
            },
          ],
        },
        id: 'po1',
        slug: '/hello-world',
        aliases: ['main'],
      },
      {},
    ],
    above: [
      {
        id: 'po2',
        aliases: ['sec'],
        children: [third],
        below: [
          {
            id: third,
            slug: '/third',
            parents: [
              {
                id: 'po2',
              },
            ],
          },
        ],
      },
    ],
  })

  t.true(true)
})
