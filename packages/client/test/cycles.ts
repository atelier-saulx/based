import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions'
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
    types: {
      cyclic: {
        prefix: 'cy',
        fields: {
          value: { type: 'number' },
          next: { type: 'reference' },
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

test('children cycle: delete root', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'cy1',
    value: 1,
    children: [
      {
        $id: 'cy2',
        value: 2,
        children: [
          {
            $id: 'cy3',
            value: 3,
          },
        ],
      },
    ],
  })
  await client.set({
    $id: 'cy1',
    parents: ['root', 'cy3'],
  })

  // Note that $recursive is required to delete cycles that are descendants of the
  // deleted node.
  deepEqualIgnoreOrder(
    t,
    await client.delete({ $id: 'root', $returnIds: true, $recursive: true }),
    ['root', 'cy1', 'cy2', 'cy3']
  )
  t.deepEqual(
    await client.get({ $id: 'root', descendants: { id: true, $list: true } }),
    { descendants: [] }
  )
  t.deepEqual(await client.get({ $id: 'cy1', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy2', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy3', id: true }), {})
})

test('children cycle: delete first node', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'cy1',
    value: 1,
    children: [
      {
        $id: 'cy2',
        value: 2,
        children: [
          {
            $id: 'cy3',
            value: 3,
          },
        ],
      },
    ],
  })
  await client.set({
    $id: 'cy3',
    children: ['cy1'],
  })

  deepEqualIgnoreOrder(
    t,
    await client.delete({ $id: 'cy1', $returnIds: true }),
    ['cy1', 'cy2', 'cy3']
  )
  t.deepEqual(
    await client.get({ $id: 'root', descendants: { id: true, $list: true } }),
    { descendants: [] }
  )
  t.deepEqual(await client.get({ $id: 'cy1', id: true, descendants: [] }), {})
  t.deepEqual(await client.get({ $id: 'cy2', id: true, descendants: [] }), {})
  t.deepEqual(await client.get({ $id: 'cy3', id: true, descendants: [] }), {})
})

test('delete ref', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'cy1',
    value: 1,
    next: {
      $id: 'cy2',
      value: 2,
      next: {
        $id: 'cy3',
        value: 3,
      },
    },
  })
  await client.set({
    $id: 'cy3',
    parents: [],
    next: 'cy1',
  })

  t.deepEqual(
    await client.get({
      $id: 'cy1',
      next: true,
    }),
    { next: 'cy2' }
  )
  t.deepEqual(
    await client.get({
      $id: 'cy2',
      next: true,
    }),
    { next: 'cy3' }
  )
  t.deepEqual(
    await client.get({
      $id: 'cy3',
      next: true,
    }),
    { next: 'cy1' }
  )

  deepEqualIgnoreOrder(
    t,
    await client.delete({ $id: 'cy1', $returnIds: true }),
    ['cy1']
  )
  t.deepEqual(await client.get({ $id: 'cy1', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy2', id: true }), { id: 'cy2' })
  t.deepEqual(await client.get({ $id: 'cy3', id: true }), { id: 'cy3' })
})
