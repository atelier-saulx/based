import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestInterface<{
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

test.afterEach(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('get - correct order', async (t) => {
  const { client } = t.context
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
