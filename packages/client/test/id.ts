import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port: number
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
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test('generates a unique id from type', async (t) => {
  await client.updateSchema({
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
    },
  })

  const id1 = await client.id({ type: 'match' })

  const id2 = await client.id({ type: 'match' })
  t.true(id1 !== id2)
  t.true(/ma.+/.test(id1))
  // new types what this means is that the client allways needs to load a map add it to prefix
  // allways subscribe on it (hash)
})
