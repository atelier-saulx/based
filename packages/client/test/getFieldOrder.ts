import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    types: {
      flurps: {
        prefix: 'fl',
        fields: {
          x: { type: 'string' },
          f: {
            type: 'object',
            properties: {
              a: { type: 'string' },
              b: { type: 'string' },
              c: { type: 'string' },
              d: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('get - correct order', async (t) => {
  await client.set({
    $id: 'flA',
    f: {
      d: 'a',
      b: 'b',
      c: 'c',
    },
  })

  const x = await client.get({
    $id: 'flA',
    f: true,
  })

  await client.set({
    $id: 'flA',
    f: {
      d: 'xxxx',
      a: 'x',
    },
  })

  const y = await client.get({
    $id: 'flA',
    f: true,
  })

  for (let i = 0; i < 1; i++) {
    await client.set({
      $id: 'flA',
      x: i + '',
    })

    const z = await client.get({
      $id: 'flA',
      f: true,
    })
    t.deepEqual(z, y)
  }
})
