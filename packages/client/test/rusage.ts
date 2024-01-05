import anyTest, { TestFn } from 'ava'
import { deserialize } from 'data-record'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { selva_rusage } from '../src/protocol/index.js'
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

test('test rusage command', async (t) => {
  const { client } = t.context

  const [rusage_self, rusage_children] = (await client.command('rusage')).map(
    (buf: any) => deserialize(selva_rusage, buf)
  )

  t.truthy(Number(rusage_self.ru_maxrss) > 20 * 1024 * 1024)
  t.deepEqual(rusage_children.ru_maxrss, 0n)
})
