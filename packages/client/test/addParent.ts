import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestInterface<{
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
})

test.afterEach(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('when using parents.$add empty, root should still be added in ancestors (low prio)', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    types: {
      sport: {
        prefix: 'sp',
        fields: {
          num: { type: 'number' },
        },
      },
    },
  })

  await client.set({
    type: 'sport',
    $id: 'sp11',
    num: 1,
    parents: {
      $add: [],
    },
  })

  t.deepEqualIgnoreOrder(await client.get({ $id: 'sp11', ancestors: true }), {
    ancestors: ['root'],
  })
})
