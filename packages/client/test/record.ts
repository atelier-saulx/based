import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import './assertions/index.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions/index.js'

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
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
        },
      },
      hello: {
        prefix: 'he',
        fields: {
          name: { type: 'string' },
          members: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                x: { type: 'string' },
                refs: { type: 'references' },
              },
            },
          },
        },
      },
      jsonTest: {
        prefix: 'js',
        fields: {
          jsonRecord: {
            type: 'record',
            values: { type: 'json' },
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

test('remove object from record', async (t) => {
  const { client } = t.context
  const thingId = await client.set({
    type: 'thing',
    name: 'blurp',
  })

  const id = await client.set({
    type: 'hello',
    name: 'derp',
    members: {
      0: {
        x: 'hallo',
        refs: [thingId],
      },
      1: {
        x: 'doei',
      },
    },
  })

  const res1 = await client.get({
    $id: id,
    name: true,
    members: {
      '*': {
        x: true,
        refs: true,
      },
    },
  })

  deepEqualIgnoreOrder(t, res1.members[0], { x: 'hallo', refs: [thingId] })
  deepEqualIgnoreOrder(t, res1.members[1], { x: 'doei' })

  await client.set({
    $id: id,
    members: {
      0: { $delete: true },
      1: { $delete: true },
    },
  })

  await wait(500)

  const res2 = await client.get({
    $id: id,
    name: true,
    members: {
      '*': {
        x: true,
        refs: true,
      },
    },
  })

  deepEqualIgnoreOrder(t, res2, { name: 'derp' })
})

test.failing('json record should allow based-db reserved keys', async (t) => {
  const { client } = t.context

  let id: string
  await t.notThrowsAsync(async () => {
    id = await client.set({
      type: 'jsonTest',
      jsonRecord: {
        record1: {
          fieldA: 'record1FieldA',
        },
        record2: {
          fieldA: 'record2FieldA',
          $id: 'id_inside_json',
        },
      },
    })
  })
  if (id) {
    const result = await client.get({ $id: id, $all: true })
    t.is(result.jsonRecord.record2.$id, 'id_inside_json')
  }
})
