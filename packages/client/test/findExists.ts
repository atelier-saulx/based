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
    language: 'en',
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
        },
      },
      special: {
        prefix: 'sp',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          description: { type: 'text' },
          value: {
            type: 'number',
          },
          status: { type: 'number' },
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

test('find - numeric exists field', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    type: 'match',
    name: 'match 2',
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    {
      items: [
        {
          name: 'match 1',
          nonsense: 'yes',
        },
      ],
    }
  )
})

test('find - string field only exists', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    type: 'league',
    name: 'league 2',
    thing: 'yes some value here',
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      // id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'league',
              },
              {
                $field: 'thing',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    {
      // id: 'root',
      items: [{ name: 'league 2' }],
    }
  )
})

test('find - numeric not exists field', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    type: 'match',
    name: 'match 2',
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'notExists',
              },
            ],
          },
        },
      },
    }),
    { items: [{ name: 'match 2' }] }
  )
})

test('find - string field only not exists indexed', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    type: 'league',
    name: 'league 2',
    thing: 'yes some value here',
  })

  const m = await client.get({
    $id: 'root',
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
            {
              $field: 'thing',
              $operator: 'notExists',
            },
          ],
        },
      },
    },
  })

  deepEqualIgnoreOrder(t, m, { items: [{ name: 'league 1' }] })
})

test('find - text exists field', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    $language: 'en',
    $id: 'ma1',
    type: 'match',
    description: 'match 1',
    value: 1,
  })

  await client.set({
    $language: 'en',
    $id: 'ma2',
    type: 'match',
    name: 'match 2',
    value: 1,
  })

  await client.set({
    $language: 'en',
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $language: 'en',
    $id: 'sp1',
    type: 'special',
    name: 'special 1',
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { items: [{ description: { en: 'match 1' } }] }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: 'root',
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { items: [{ description: 'match 1' }] }
  )
})
