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

test('expiring matches on direct get', async (t) => {
  const { client } = t.context
  const matches = await Promise.all([
    client.set({
      type: 'match',
      value: 1,
      title: 'value1',
    }),
    client.set({
      type: 'match',
      value: 2,
      title: 'value2',
    }),
  ])

  const expire = BigInt((Date.now() / 1000 + 1) | 0)
  const before = await Promise.all(
    matches.map((id) => client.command('hierarchy.expire', [id]))
  )
  await Promise.all(
    matches.map((id) => client.command('hierarchy.expire', [id, expire]))
  )
  const after = await Promise.all(
    matches.map((id) => client.command('hierarchy.expire', [id]))
  )

  t.deepEqual(before, [[0n], [0n]])
  t.deepEqual(after, [[expire], [expire]])

  await new Promise((r) =>
    setTimeout(r, Number(expire * 1000n) - Date.now() + 1000)
  )

  t.deepEqual(
    await Promise.all(matches.map((id) => client.get({ $id: id, type: true }))),
    [{}, {}]
  )
})
