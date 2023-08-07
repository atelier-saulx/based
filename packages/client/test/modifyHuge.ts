import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (_t) => {
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
      match: {
        prefix: 'ma',
        fields: {
          str: { type: 'string' },
          title: { type: 'text' },
          ...[...Array(200)]
            .map((_, i) => [`value${i}`, i])
            .reduce((acc, [a, b]) => ((acc[a] = { type: 'number' }), acc), {}),
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

test.serial('set all', async (t) => {
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    ...[...Array(200)]
      .map((_, i) => [`value${i}`, i])
      .reduce((acc, [a, b]) => ((acc[a] = b), acc), {}),
  })

  t.assert(true)
})

test.serial.skip('set many', async (t) => {
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
