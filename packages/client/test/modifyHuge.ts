import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions'
import getPort from 'get-port'

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
    translations: ['de', 'nl'],
    types: {
      match: {
        prefix: 'ma',
        fields: {
          str: { type: 'string' },
          title: { type: 'text' },
          ...[...Array(200)]
            .map((_, i) => [`value${i}`, i])
            .reduce((acc, [a, _b]) => ((acc[a] = { type: 'number' }), acc), {}),
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

test('set all', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    ...[...Array(200)]
      .map((_, i) => [`value${i}`, i])
      .reduce((acc, [a, b]) => ((acc[a] = b), acc), {}),
  })

  t.assert(true)
})

test.skip('set many', async (t) => {
  const { client } = t.context
  const promises: any[] = []

  let ts = Date.now()
  for (let i = 0; i < 100e3; i++) {
    promises.push(
      client.set({
        $id: 'ma' + i,
        str: 'hello ' + i,
      })
    )
  }

  await Promise.all(promises)
  let now = Date.now()
  console.log('Setting 100k things took', (now - ts) / 1e3, 'seconds')

  ts = Date.now()
  const res = await client.get({
    matches: {
      id: true,
      str: true,
      $list: {
        $find: {
          $traverse: 'children',
        },
      },
    },
  })

  now = Date.now()
  console.dir(res)

  console.log('Getting 100k things took', (now - ts) / 1e3, 'seconds')
  t.assert(true)
})
