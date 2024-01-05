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
    translations: ['de'],
    types: {
      sport: {
        prefix: 'sp',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      category: {
        prefix: 'ca',
        fields: {
          name: { type: 'string' },
          title: {
            type: 'text',
          },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: {
            type: 'text',
          },
          published: {
            type: 'boolean',
          },
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

test('real world highlights', async (t) => {
  const { client } = t.context
  await client.set({
    $language: 'en',
    $id: 'sp1',
    title: 'sport nice',
    children: [
      {
        $id: 'ca1',
        title: 'Highlights',
        name: 'highlights',
        children: [
          {
            $id: 'ma1',
            title: 'match 1',
            published: true,
          },
          {
            $id: 'ma2',
            title: 'match 2',
            published: true,
          },
          {
            $id: 'ma3',
            title: 'match 3',
            published: false,
          },
        ],
      },
    ],
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'sp1',
      $language: 'en',
      component: {
        $value: 'Highlights',
      },
      children: {
        type: true,
        title: true,
        id: true,
        $list: {
          $find: {
            $traverse: 'children',
            $find: {
              $traverse: 'children',
              $filter: [
                {
                  $field: 'published',
                  $operator: '=',
                  $value: true,
                },
              ],
            },
            $filter: [
              {
                $value: 'category',
                $field: 'type',
                $operator: '=',
              },
              {
                $value: 'highlights',
                $field: 'name',
                $operator: '=',
              },
            ],
          },
          $limit: 3,
        },
        date: true,
        video: true,
      },
      title: {
        $value: 'Bla bla',
      },
    }),
    {
      component: 'Highlights',
      title: 'Bla bla',
      children: [
        { id: 'ma1', type: 'match', title: 'match 1' },
        { id: 'ma2', type: 'match', title: 'match 2' },
      ],
    }
  )
  t.pass()
})
