import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { SelvaServer, startOrigin } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import getPort from 'get-port'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.timeout(5000)
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
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('support index and title', async (t) => {
  const { client } = t.context

  await client.updateSchema({
    types: {
      aType: {
        prefix: 'at',
        fields: {
          fieldA: {
            type: 'string',
            index: 1,
            title: 'this is title',
          },
        },
      },
    },
  })

  await wait(200)

  t.is(client.schema.types.aType.fields.fieldA.index, 1)
  t.is(client.schema.types.aType.fields.fieldA.title, 'this is title')
})
