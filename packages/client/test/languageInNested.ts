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
      dictionary: {
        prefix: 'di',
        fields: {
          words: {
            type: 'object',
            properties: {
              rando: { type: 'text' },
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

test.serial('$language should be applied in nested text', async (t) => {
  const dictionary = await client.set({
    $language: 'en',
    type: 'dictionary',
    words: {
      rando: 'my word',
    },
  })

  t.deepEqual(
    await client.get({
      $id: dictionary,
      $language: 'en',
      words: true,
    }),
    { words: { rando: 'my word' } }
  )
})
