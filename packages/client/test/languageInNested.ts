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

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('$language should be applied in nested text', async (t) => {
  const { client } = t.context
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
