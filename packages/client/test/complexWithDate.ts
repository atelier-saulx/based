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
    root: {
      fields: {
        title: { type: 'text' },
      },
    },
    types: {
      league: {
        prefix: 'le',
        fields: {
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
          date: {
            type: 'timestamp',
          },
          published: {
            type: 'boolean',
          },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          title: {
            type: 'text',
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

test('yes', async (t) => {
  const { client } = t.context
  await client.set({
    type: 'league',
    $id: 'le1',
    $language: 'en',
    title: 'League 1',
  })

  await client.set({
    type: 'team',
    $id: 'te1',
    $language: 'en',
    title: 'Team 1',
    parents: ['le1'],
  })

  await client.set({
    type: 'match',
    $id: 'ma1',
    $language: 'en',
    title: 'Match 1',
    date: 1578039984000,
    published: true,
    parents: ['te1', 'root'],
  })

  await wait(500)

  const result = await client.get({
    $language: 'en',
    matches: {
      id: true,
      title: true,
      date: true,
      teams: {
        id: true,
        title: true,
        $list: {
          $find: {
            $traverse: 'parents',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
            ],
          },
        },
      },
      team: {
        id: true,
        title: true,
        $find: {
          $traverse: 'ancestors',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'team',
            },
          ],
        },
      },
      $list: {
        $offset: 0,
        $limit: 100,
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
            {
              $field: 'published',
              $operator: '=',
              $value: true,
            },
            {
              $field: 'date',
              $operator: '>',
              $value: 1577883600000,
            },
            {
              $field: 'date',
              $operator: '<',
              $value: 1580515199000,
            },
          ],
        },
      },
    },
  })

  t.truthy(result.matches && result.matches.length)
  t.truthy(result.matches[0].teams && result.matches[0].teams.length)
  t.truthy(result.matches[0].team && result.matches[0].team.title)
})
