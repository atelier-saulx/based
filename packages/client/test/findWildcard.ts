import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions/index.js'

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
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
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
          record: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                a: {
                  type: 'string',
                },
                b: {
                  type: 'string',
                },
                nestedRecord: {
                  type: 'record',
                  values: {
                    type: 'object',
                    properties: {
                      a: {
                        type: 'string',
                      },
                      b: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
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

test('find - with wildcard', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {
      obj: {
        a: 'abba',
        b: 'babba',
        nestedRecord: {
          hello: {
            a: 'abba',
            b: 'babba',
          },
          yellow: {
            a: 'abba2',
            b: 'babba2',
          },
        },
      },
      obj2: {
        a: 'abba2',
        b: 'babba2',
        nestedRecord: {
          hello: {
            a: '-abba',
            b: '-babba',
          },
          yellow: {
            a: '-abba2',
            b: '-babba2',
          },
        },
      },
    },
  })

  await client.set({
    type: 'match',
    name: 'match 2',
    value: 2,
    record: {
      obj: {
        a: '2_abba',
        b: '2_babba',
        nestedRecord: {
          hello: {
            a: '2_abba',
            b: '2_babba',
          },
          yellow: {
            a: '2_abba2',
            b: '2_babba2',
          },
        },
      },
      obj2: {
        a: '2_abba2',
        b: '2_babba2',
        nestedRecord: {
          hello: {
            a: '2_-abba',
            b: '2_-babba',
          },
          yellow: {
            a: '2_-abba2',
            b: '2_-babba2',
          },
        },
      },
    },
  })

  const r = await client.get({
    $id: 'root',
    id: true,
    items: {
      name: true,
      record: {
        '*': {
          a: true,
          b: true,
        },
      },
      $list: {
        $sort: {
          $field: 'name',
          $order: 'asc',
        },
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
          ],
        },
      },
    },
  })
  console.info(JSON.stringify({ hmmwut: r }, null, 2))
  deepEqualIgnoreOrder(t, r.items[0], {
    name: 'match 1',
    record: {
      obj: { a: 'abba', b: 'babba' },
      obj2: { a: 'abba2', b: 'babba2' },
    },
  })

  deepEqualIgnoreOrder(t, r.items[1], {
    name: 'match 2',
    record: {
      obj: { a: '2_abba', b: '2_babba' },
      obj2: { a: '2_abba2', b: '2_babba2' },
    },
  })
})

test('find - nothing found with a wildcard', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {},
  })

  await client.set({
    type: 'match',
    name: 'match 2',
    value: 2,
    record: {},
  })

  console.dir(
    {
      hmm: await client.get({
        $id: 'root',
        id: true,
        items: {
          name: true,
          record: {
            '*': {
              a: true,
              b: true,
            },
          },
          $list: {
            $find: {
              $traverse: 'children',
              $filter: [
                {
                  $field: 'type',
                  $operator: '=',
                  $value: 'match',
                },
              ],
            },
          },
        },
      }),
    },
    { depth: 8 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        record: {
          '*': {
            a: true,
            b: true,
          },
        },
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    }),
    {
      id: 'root',
      items: [
        {
          name: 'match 1',
        },
        {
          name: 'match 2',
        },
      ],
    }
  )
})
