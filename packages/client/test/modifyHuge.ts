import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (_t) => {
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
      match: {
        prefix: 'ma',
        fields: {
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
