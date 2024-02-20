import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
// import { deepEqualIgnoreOrder } from './assertions/index.js'

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
    types: {
      aType: {
        prefix: 'at',
        fields: {
          value: { type: 'string' },
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

// TODO: waiting for $operation to be supported
test.skip('$operation upsert', async (t) => {
  const { client } = t.context
  await client.set({
    $operation: 'upsert',
    $id: 'at1',
    value: 'first',
  })
  t.is((await client.get({ $id: 'at1', value: true })).value, 'first')
  await client.set({
    $operation: 'upsert',
    $id: 'at1',
    value: 'second',
  })
  t.is((await client.get({ $id: 'at1', value: true })).value, 'second')
})

// $operation create
// $operation update
// $operation insert ?
