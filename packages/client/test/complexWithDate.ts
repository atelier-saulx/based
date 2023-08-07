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
    languages: ['en'],
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('yes', async (t) => {
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
