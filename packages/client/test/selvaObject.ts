import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
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
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
        },
      },
    },
  })

  await t.context.client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    children: [
      {
        $id: 'maTest0002',
        title: { en: 'ma2' },
      },
    ],
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('get a single keyval', async (t) => {
  const { client } = t.context

  t.deepEqual(
    await client.command('object.get', ['', 'maTest0001', 'title.en']),
    ['ma1']
  )
})

test('get all', async (t) => {
  const { client } = t.context

  const res = await client.command('object.get', ['', 'maTest0001'])
  res[0].shift()
  res[0].shift()
  res[0].pop()
  res[0].pop()
  t.deepEqual(res, [
    ['id', 'maTest0001', 'title', ['en', 'ma1'], 'type', 'match'],
  ])
})

test('obj len', async (t) => {
  const { client } = t.context

  t.deepEqual(await client.command('object.len', ['maTest0001']), [5n])
})

test('string len', async (t) => {
  const { client } = t.context

  t.deepEqual(await client.command('object.len', ['maTest0001', 'title.en']), [
    3n,
  ])
})

test('meta', async (t) => {
  const { client } = t.context

  await client.command('object.set', ['maTest0001', 'a', 's', 'abc'])
  t.deepEqual(await client.command('object.getMeta', ['maTest0001', 'a']), [0n])
  t.deepEqual(
    await client.command('object.setMeta', ['maTest0001', 'a', 0xbaddcafe]),
    [1n]
  )
  t.deepEqual(await client.command('object.getMeta', ['maTest0001', 'a']), [
    BigInt('0xbaddcafe'),
  ])
})

test('deleting deep objects', async (t) => {
  const { client } = t.context

  await client.command('object.set', ['maTest0001', 'a.r.s', 's', 'Hello'])
  await client.command('object.set', ['maTest0001', 'a.s.s', 's', 'Hallo'])
  t.deepEqual(await client.command('object.len', ['maTest0001', 'a']), [2n])

  await client.command('object.del', ['maTest0001', 'a.r'])
  t.deepEqual(await client.command('object.len', ['maTest0001', 'a']), [1n])
})

test('deleting a field from object arrays', async (t) => {
  const { client } = t.context

  await client.command('object.set', ['maTest0001', 'a.r[0].s1', 's', 'Hello'])
  await client.command('object.set', ['maTest0001', 'a.r[0].s2', 's', 'Hello'])
  await client.command('object.set', ['maTest0001', 'a.r[0].s3', 's', 'Hello'])
  await client.command('object.set', ['maTest0001', 'a.r[1].s', 's', 'Hello'])
  t.deepEqual(await client.command('object.len', ['maTest0001', 'a.r']), [2n])

  t.deepEqual(
    await client.command('object.get', ['', 'maTest0001', 'a.r[0]']),
    [['s1', 'Hello', 's2', 'Hello', 's3', 'Hello']]
  )

  await client.command('modify', ['maTest0001', '', ['7', 'a.r[0].s1', '']])
  t.deepEqual(
    await client.command('object.get', ['', 'maTest0001', 'a.r[0]']),
    [['s2', 'Hello', 's3', 'Hello']]
  )

  await client.command('object.del', ['maTest0001', 'a.r[0].s2'])
  t.deepEqual(
    await client.command('object.get', ['', 'maTest0001', 'a.r[0]']),
    [['s3', 'Hello']]
  )

  // This will delete the whole array
  // Don't do this but use modify instead
  //await client.redis.selva_object_del('maTest0001', 'a.r[0]')
  //t.deepEqual(
  //  await client.redis.selva_object_get('', 'maTest0001', 'a.r'),
  //  [ [ 's', 'Hello' ] ]
  //)
})
