import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
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

  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('set simple fields', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    types: {
      article: {
        prefix: 'ar',
        fields: {
          name: {
            type: 'string',
          },
        },
      },
    },
  })

  const d = Date.now()
  for (let i = 0; i < 1e6; i++) {
    client.set({
      type: 'article',
      name: 'name ' + i,
    })
  }
  console.log(Date.now() - d, 'ms')

  t.pass()
})
