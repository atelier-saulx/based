import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port = 8081
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
    languages: ['en', 'de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
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

// TODO: traverse list not working
test.serial.skip('get - simple $list with id $traverse', async (t) => {
  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      $id: 'cu' + i,
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  const c = await client.get({
    $id: 'cuA',
    items: {
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $find: {
          $traverse: ['cu1', 'cu2', 'cu3'],
        },
      },
    },
  })

  t.deepEqual(c, {
    items: [
      { value: 1, name: 'flurp1' },
      { value: 2, name: 'flurp2' },
      { value: 3, name: 'flurp3' },
    ],
  })
})
