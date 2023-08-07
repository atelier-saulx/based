import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (t) => {
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(500)
})

test.serial('find - with wildcard', async (t) => {
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
  t.deepEqualIgnoreOrder(r.items[0], {
    name: 'match 1',
    record: {
      obj: { a: 'abba', b: 'babba' },
      obj2: { a: 'abba2', b: 'babba2' },
    },
  })

  t.deepEqualIgnoreOrder(r.items[1], {
    name: 'match 2',
    record: {
      obj: { a: '2_abba', b: '2_babba' },
      obj2: { a: '2_abba2', b: '2_babba2' },
    },
  })
})

test.serial('find - nothing found with a wildcard', async (t) => {
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

  t.deepEqualIgnoreOrder(
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
