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
    translations: ['de', 'nl'],
    root: {
      fields: {
        ref: { type: 'reference' },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          ref: { type: 'reference' },
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

test('implicitly created nodes', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'root',
    children: ['ma1', 'ma2'],
    ref: 'ma3',
  })
  await client.set({
    $id: 'ma5',
    ref: {
      $id: 'ma6',
      ref: 'ma4',
    },
    children: [
      {
        $id: 'ma7',
      },
    ],
  })

  t.deepEqual(
    await client.get({
      ref: {
        id: true,
        type: true,
      },
      matches: {
        id: true,
        type: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    }),
    {
      matches: [
        { id: 'ma1', type: 'match' },
        { id: 'ma2', type: 'match' },
        { id: 'ma5', type: 'match' },
        { id: 'ma6', type: 'match' },
        { id: 'ma7', type: 'match' },
      ],
      ref: { id: 'ma3', type: 'match' },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'ma5',
      id: true,
      type: true,
      children: {
        id: true,
        type: true,
        $list: {
          $find: {
            $traverse: 'children',
          },
        },
      },
      ref: {
        id: true,
        type: true,
      },
    }),
    {
      id: 'ma5',
      type: 'match',
      children: [{ id: 'ma7', type: 'match' }],
      ref: { id: 'ma6', type: 'match' },
    }
  )
})
