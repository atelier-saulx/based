import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
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
      aType: {
        prefix: 'at',
        fields: {
          json: {
            type: 'json',
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

test('json fields should allow based-db query reserved keys', async (t) => {
  const { client } = t.context

  let id: string
  await t.notThrowsAsync(async () => {
    id = await client.set({
      type: 'aType',
      json: {
        fieldA: 'record2FieldA',
        $id: '$id_inside_json',
        $alias: '$alias_inside_json',
      },
    })
  })
  if (id) {
    const result = await client.get({ $id: id, $all: true })
    t.is(result.json.$id, '$id_inside_json')
    t.is(result.json.$alias, '$alias_inside_json')
  }
})
