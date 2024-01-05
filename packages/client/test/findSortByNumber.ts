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
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'string' },
          value: { type: 'number' },
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

test('sort by number with missing field values', async (t) => {
  const { client } = t.context
  await client.set({
    type: 'match',
    value: 1,
    title: 'value1',
  })
  await client.set({
    type: 'match',
    value: 2,
    title: 'value2',
  })
  await client.set({
    type: 'match',
    title: 'value none',
  })
  await client.set({
    type: 'match',
    value: 4,
    title: 'value4',
  })
  await client.set({
    type: 'match',
    title: 'value none',
  })

  t.deepEqual(
    await client.get({
      children: {
        value: true,
        $list: {
          $sort: {
            $field: 'value',
            $order: 'asc',
          },
        },
      },
    }),
    { children: [{ value: 1 }, { value: 2 }, { value: 4 }, {}, {}] }
  )
})
