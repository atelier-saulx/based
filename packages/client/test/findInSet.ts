import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions'
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
    types: {
      user: {
        prefix: 'us',
        fields: {
          roles: {
            type: 'set',
            items: {
              type: 'string',
            },
          },
          numbers: {
            type: 'set',
            items: {
              type: 'number',
            },
          },
          sinks: {
            type: 'set',
            items: {
              type: 'number',
            },
          },
          ints: {
            type: 'set',
            items: {
              type: 'integer',
            },
          },
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

test('search user roles', async (t) => {
  const { client } = t.context
  await client.set({
    type: 'user',
    roles: ['club', 'club:id1'],
  })

  await client.set({
    type: 'user',
    roles: ['club', 'club:id2'],
  })

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'roles',
                $operator: 'has',
                $value: 'club:id1',
              },
            },
          },
        },
      })
    ).descendants.length,
    1
  )

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'roles',
                $operator: 'has',
                $value: 'club:id2',
              },
            },
          },
        },
      })
    ).descendants.length,
    1
  )

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'roles',
                $operator: 'has',
                $value: 'club',
              },
            },
          },
        },
      })
    ).descendants.length,
    2
  )

  deepEqualIgnoreOrder(
    t,
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'roles',
                $operator: 'has',
                $value: 'rando',
              },
            },
          },
        },
      })
    ).descendants,
    []
  )
})

test('search user numbers', async (t) => {
  const { client } = t.context
  await client.set({
    type: 'user',
    numbers: [1, 2.4, 3, 4],
    sinks: [1, 7.0, 4.5, 8.25],
    ints: [57082, 0x01234567, 16435934],
  })

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'numbers',
                $operator: 'has',
                $value: 1,
              },
            },
          },
        },
      })
    ).descendants.length,
    1
  )

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'sinks',
                $operator: 'has',
                $value: 7.0,
              },
            },
          },
        },
      })
    ).descendants.length,
    1
  )

  t.is(
    (
      await client.get({
        descendants: {
          id: true,
          $list: {
            $find: {
              $filter: {
                $field: 'ints',
                $operator: 'has',
                $value: 16435934,
              },
            },
          },
        },
      })
    ).descendants.length,
    1
  )
})
