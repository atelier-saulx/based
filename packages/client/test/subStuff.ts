import test from 'ava'
import { BasedDbClient, protocol } from '../src/index.js'
import { startOrigin } from '@based/db-server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'
import { deserialize } from 'data-record'

test('descendants sub', async (t) => {
  const port = await getPort()
  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    language: 'en',
    translations: ['nl', 'de', 'fi'],
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

  let evCnt: number = 0
  let markerId: number = 0
  client.on('pubsub', ([chId, val]) => {
    if (chId === 0) {
      const rec = deserialize(protocol.sub_marker_pubsub_message_def, val[0])
      console.log('MARKER EVENT', chId, rec)
      evCnt++
      markerId = Number(rec.marker_id)
    } else {
      console.log('EVENT', chId, val[0].toString('utf8'))
    }
  })

  await client.command('subscribe', [0])
  await client.command('subscribe', [1])
  await wait(2e3)
  await client.command('publish', [1, 'hello'])
  await wait(1e3)

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

  await client.set({
    $alias: 'sec',
    type: 'post',
    slug: { $delete: true },
    parents: { $add: ['root'] },
    uniqs: {
      a: 1,
      b: 2,
    },
    tags: { $remove: ['horror'] },
  })

  let sub = await client.sub({
    things: {
      $all: true,
      aliases: true,
      children: true,
      createdAt: false,
      updatedAt: false,
      hmm: { $field: ['nonExistingField', 'children'] },
      parents: {
        id: true,
        slug: true,
        $list: true,
      },
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
  await sub.cleanup()
  if (sub.pending) {
    await client.refreshMarker(12276536598524)
  }
  await sub.fetch()
  let find = await sub.getValue()

  console.dir({ find }, { depth: 8 })

  t.deepEqual(find.things.length, 2)
  t.deepEqual(find, {
    things: [
      {
        type: 'post',
        aliases: ['main'],
        arys: {
          floats: [-1.1, 0, 1.1, 2.2, 3.3, 4.4, 5.5],
          ints: [1, 6, 3, 4, 5],
          objs: [{ a: 1 }, { b: 'hello' }],
          strs: ['a', 'b', 'c', 'def', 'gh'],
        },
        bool: true,
        id: 'po1',
        int: 112,
        num: 25.5,
        obj: { a: 11, b: 'hello' },
        slug: '/hello-world',
        ts: 1690289344322,
        children: ['po2'],
        hmm: ['po2'],
        parents: [{ id: 'root' }],
      },
      {
        type: 'post',
        aliases: ['sec'],
        id: 'po2',
        int: 2,
        tags: ['action', 'comedy'],
        uniqs: 2,
        parents: [{ id: 'po1', slug: '/hello-world' }, { id: 'root' }],
      },
    ],
  })

  let subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  console.dir({ subs }, { depth: 8 })

  const third = await client.set({
    $alias: '3rd',
    type: 'post',
    slug: '/third',
    parents: ['po2'],
  })

  sub = await client.sub(
    {
      things: {
        $all: true,
        aliases: true,
        children: true,
        createdAt: false,
        updatedAt: false,
        hmm: { $field: ['nonExistingField', 'children'] },
        parents: {
          id: true,
          slug: true,
          $list: true,
        },
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
    },
    {
      subId: 13416525902349,
      markerId: 12276536598524, // descendants marker id
    }
  )

  await sub.cleanup()
  if (sub.pending) {
    await client.refreshMarker(12276536598524)
  }
  await sub.fetch()
  find = await sub.getValue()

  console.dir({ find }, { depth: 8 })

  t.deepEqual(find.things.length, 3)
  t.deepEqual(find, {
    things: [
      {
        type: 'post',
        aliases: ['main'],
        arys: {
          floats: [-1.1, 0, 1.1, 2.2, 3.3, 4.4, 5.5],
          ints: [1, 6, 3, 4, 5],
          objs: [{ a: 1 }, { b: 'hello' }],
          strs: ['a', 'b', 'c', 'def', 'gh'],
        },
        bool: true,
        id: 'po1',
        int: 112,
        num: 25.5,
        obj: { a: 11, b: 'hello' },
        slug: '/hello-world',
        ts: 1690289344322,
        children: ['po2'],
        hmm: ['po2'],
        parents: [{ id: 'root' }],
      },
      {
        type: 'post',
        aliases: ['sec'],
        id: 'po2',
        int: 2,
        tags: ['action', 'comedy'],
        uniqs: 2,
        children: [third],
        hmm: [third],
        parents: [{ id: 'po1', slug: '/hello-world' }, { id: 'root' }],
      },
      {
        id: third,
        type: 'post',
        slug: '/third',
        aliases: ['3rd'],
        parents: [{ id: 'po2' }],
      },
    ],
  })

  subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  console.dir({ subs }, { depth: 8 })

  for (const nodeId of ['root', 'po1', 'po2', third]) {
    const d = await client.command('subscriptions.debug', [nodeId])
    console.dir({ [nodeId]: d }, { depth: 6 })
  }

  await wait(1e3)
  t.deepEqual(evCnt, 1)
  t.deepEqual(markerId, 12276536598524)

  client.destroy()
  await server.destroy()
})

test('node sub', async (t) => {
  const port = await getPort()
  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    language: 'en',
    translations: ['nl', 'de', 'fi'],
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

  let evCnt: number = 0
  let markerId: number = 0
  client.on('pubsub', ([chId, val]) => {
    if (chId === 0) {
      const rec = deserialize(protocol.sub_marker_pubsub_message_def, val[0])
      console.log('MARKER EVENT', chId, rec)
      evCnt++
      markerId = Number(rec.marker_id)
    } else {
      console.log('EVENT', chId, val[0].toString('utf8'))
    }
  })

  await client.command('subscribe', [0])
  await client.command('subscribe', [1])
  await wait(2e3)
  await client.command('publish', [1, 'hello'])
  await wait(1e3)

  await client.set({
    $id: 'me1',
    str: 'hello',
    rec: {
      a: { a: 'hello', b: 1 },
      b: { a: 'olleh', b: -1 },
    },
  })

  let sub = await client.sub({
    $id: 'me1',
    str: true,
    rec: true,
  })
  await sub.cleanup()
  if (sub.pending) {
    await client.refreshMarker(12747838989715)
  }
  await sub.fetch()
  let find = await sub.getValue()

  console.dir({ find }, { depth: 8 })

  t.deepEqual(find, {
    str: 'hello',
    rec: {
      a: { a: 'hello', b: 1 },
      b: { a: 'olleh', b: -1 },
    },
  })

  let subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  console.dir({ subs }, { depth: 8 })

  await client.set({
    $id: 'me1',
    str: 'hello 2',
  })

  sub = await client.sub(
    {
      $id: 'me1',
      str: true,
      rec: true,
    },
    {
      subId: 15586939349843,
      markerId: 12747838989715, // node marker id
    }
  )

  await sub.cleanup()
  if (sub.pending) {
    await client.refreshMarker(12747838989715)
  }
  await sub.fetch()
  find = await sub.getValue()

  console.dir({ find }, { depth: 8 })

  t.deepEqual(find, {
    str: 'hello 2',
    rec: {
      a: { a: 'hello', b: 1 },
      b: { a: 'olleh', b: -1 },
    },
  })

  subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  console.dir({ subs }, { depth: 8 })

  await wait(1e3)
  t.deepEqual(evCnt, 1)
  t.deepEqual(markerId, 12747838989715)

  client.destroy()
  await server.destroy()
})

test('alias sub', async (t) => {
  const port = await getPort()
  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    language: 'en',
    $defs: {},
    types: {
      meh: {
        prefix: 'me',
        fields: {},
      },
    },
  })

  const events = {}
  client.on('pubsub', ([chId, val]) => {
    if (chId != 0) return
    const rec = deserialize(protocol.sub_marker_pubsub_message_def, val[0])
    const markerId = Number(rec.marker_id)

    events[markerId] = events[markerId] ?? 0 + 1
  })
  await client.command('subscribe', [0])

  await client.set({
    $id: 'root',
    children: [
      {
        $id: 'me1',
        aliases: ['meh'],
      },
    ],
  })
  t.deepEqual(await client.command('lsaliases', []), [['meh', 'me1']])

  await client.command('subscriptions.addAlias', [42n, 1n, 'meh'])
  t.deepEqual(await client.command('subscriptions.list', []), [[[42n, 1n]]])

  await client.set({
    $id: 'me2',
    aliases: ['meh'],
  })
  t.deepEqual(await client.command('lsaliases', []), [['meh', 'me2']])

  t.deepEqual(await client.command('resolve.nodeid', [24n, 'meh']), [
    [3844743431n, 'meh', 'me2'],
  ])
  t.deepEqual(await client.command('subscriptions.list', []), [
    [
      [24n, 1n],
      [42n, 0n],
    ],
  ])

  await new Promise((r) => setTimeout(r, 5e2))
  await client.set({
    $id: 'me1',
    aliases: ['meh'],
  })
  await new Promise((r) => setTimeout(r, 5e2))

  t.deepEqual(await client.command('subscriptions.list', []), [
    [
      [24n, 0n],
      [42n, 0n],
    ],
  ])
  t.deepEqual(await client.command('subscriptions.debug', ['me1']), [[]])
  t.deepEqual(await client.command('subscriptions.debug', ['me2']), [[]])
  t.deepEqual(events, { '1': 1, '3844743431': 1 })

  client.destroy()
  await server.destroy()
})
