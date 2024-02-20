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
      glurp: {
        prefix: 'gl',
        fields: {
          levelCnt: { type: 'number' },
          title: { type: 'string' },
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

test('get in keys result', async (t) => {
  const { client } = t.context
  await Promise.all(
    [
      {
        type: 'glurp',
        $id: 'gl0',
        title: 'cookie',
      },
      {
        type: 'glurp',
        $id: 'gl1',
        title: 'glurpie pants',
      },
      {
        type: 'glurp',
        $id: 'gl2',
        title: 'glurpie pants 2',
      },
      {
        type: 'glurp',
        $id: 'gl3',
        title: 'cookie',
      },
    ].map((s) => client.set(s))
  )

  const gimme = await client.get({
    flap: {
      title: true,
      id: true,
      $list: {
        $find: {
          $traverse: ['gl0', 'gl1', 'gl2'],
          $filter: {
            $field: 'title',
            $operator: '=',
            $value: 'cookie',
          },
        },
      },
    },
  })

  console.log({ gimme })

  t.deepEqual(gimme, { flap: [{ title: 'cookie', id: 'gl0' }] })
})
