import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
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
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
  await wait(500)
})

test('basic mq', async (t) => {
  const { client } = t.context

  await client.command('mq.create', ['m'])
  await client.command('mq.post', ['m', 'hello', 'world'])
  const [msg1, msg2] = await client.command('mq.recv', ['m', 1n, 2n])
  t.deepEqual(msg1, [
    0n,
    'hello'
  ]);
  t.deepEqual(msg2, [
    1n,
    'world'
  ]);
  await client.command('mq.delete', ['m'])
})

test('mq ack & nack', async (t) => {
  const { client } = t.context

  await client.command('mq.create', ['m', 500n])

  await client.command('mq.post', ['m', 'hello', 'world'])
  let [msg] = await client.command('mq.recv', ['m']);
  t.deepEqual(msg, [
    0n,
    'hello'
  ]);
  await wait(700)
  ;[msg] = await client.command('mq.recv', ['m'])
  t.deepEqual(msg, [
    2n,
    'hello'
  ]);
  await client.command('mq.ack', ['m', msg[0]])

  ;[msg] = await client.command('mq.recv', ['m'])
  t.deepEqual(msg, [
    1n,
    'world'
  ]);
  await client.command('mq.nack', ['m', msg[0]])
  ;[msg] = await client.command('mq.recv', ['m'])
  t.deepEqual(msg, [
    3n,
    'world'
  ]);
  await client.command('mq.ack', ['m', msg[0]])
  t.deepEqual(await client.command('mq.recv', ['m']), [])
})
