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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial('search user roles', async (t) => {
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
                $value: 'rando',
              },
            },
          },
        },
      })
    ).descendants.length,
    0
  )
})

test.serial('search user numbers', async (t) => {
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
