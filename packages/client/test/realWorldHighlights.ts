import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import './assertions'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

let srv
let port: number
let client = new BasedDbClient()

test.beforeEach(async (t) => {
  port = await getPort()
  srv = await startOrigin({
    port,
    name: 'default',
  })
  client.connect({ port, host: '127.0.0.1' })

  await client.updateSchema({
    languages: ['en', 'de'],
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

test.afterEach(async (t) => {
  client.destroy()
  await srv.destroy()
  await wait(300)
})

// TODO: needs .$find.$find support
test.serial.skip('real world highlights', async (t) => {
  await client.set({
    $language: 'en',
    $id: 'sp1',
    title: 'sport nice',
    children: await Promise.all(
      [
        {
          $language: 'en',
          $id: 'ca1',
          title: 'Highlights',
          name: 'highlights',
          children: await Promise.all(
            [
              {
                $id: 'ma1',
                $language: 'en',
                title: 'match 1',
                published: true,
              },
              {
                $id: 'ma2',
                $language: 'en',
                title: 'match 2',
                published: true,
              },
              {
                $id: 'ma3',
                $language: 'en',
                title: 'match 3',
                published: false,
              },
            ].map((b) => client.set(b))
          ),
        },
      ].map((b) => client.set(b))
    ),
  })

  t.deepEqualIgnoreOrder(
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
