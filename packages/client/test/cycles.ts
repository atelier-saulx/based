import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (_t) => {
  port = await getPort()
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('children cycle: delete root', async (t) => {
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
  t.deepEqualIgnoreOrder(
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

test.serial('children cycle: delete first node', async (t) => {
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

  t.deepEqualIgnoreOrder(
    await client.delete({ $id: 'cy1', $returnIds: true }),
    ['cy1', 'cy2', 'cy3']
  )
  t.deepEqual(
    await client.get({ $id: 'root', descendants: { id: true, $list: true } }),
    { descendants: [] }
  )
  t.deepEqual(await client.get({ $id: 'cy1', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy2', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy3', id: true }), {})
})

test.serial('delete ref', async (t) => {
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

  t.deepEqualIgnoreOrder(
    await client.delete({ $id: 'cy1', $returnIds: true }),
    ['cy1']
  )
  t.deepEqual(await client.get({ $id: 'cy1', id: true }), {})
  t.deepEqual(await client.get({ $id: 'cy2', id: true }), { id: 'cy2' })
  t.deepEqual(await client.get({ $id: 'cy3', id: true }), { id: 'cy3' })
})
