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
      region: {
        prefix: 're',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      league: {
        prefix: 'le',
        fields: {
          value: { type: 'number' },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          name: { type: 'string' },
        },
      },
      season: {
        prefix: 'se',
        fields: {
          name: { type: 'string' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
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

test('find - ancestors - regions', async (t) => {
  const { client } = t.context
  const regions = await Promise.all([
    client.set({
      type: 'region',
      name: 'REGION De',
    }),
    client.set({
      type: 'region',
      name: 'REGION Nl',
    }),
  ])

  for (let i = 0; i < 11; i++) {
    await client.set({
      type: 'team',
      name: 'team region ' + i,
      parents: {
        $add: i < 6 ? regions[0] : regions[1],
      },
    })
  }

  const dutchteams = await client.get({
    teams: {
      name: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'ancestors',
              $operator: 'has',
              $value: regions[0],
            },
            {
              $field: 'type',
              $operator: '=',
              $value: 'team',
            },
          ],
        },
      },
    },
  })

  deepEqualIgnoreOrder(
    t,
    dutchteams,
    {
      teams: [
        { name: 'team region 5' },
        { name: 'team region 4' },
        { name: 'team region 3' },
        { name: 'team region 2' },
        { name: 'team region 1' },
        { name: 'team region 0' },
      ],
    },
    'dutch teams'
  )
})

test('find - ancestors - regions - no wrapping', async (t) => {
  const { client } = t.context
  const regions = await Promise.all([
    client.set({
      type: 'region',
      name: 'REGION De',
    }),
    client.set({
      type: 'region',
      name: 'REGION Nl',
    }),
  ])

  for (let i = 0; i < 11; i++) {
    await client.set({
      type: 'team',
      name: 'team region ' + i,
      parents: {
        $add: i < 6 ? regions[0] : regions[1],
      },
    })
  }

  const dutchteams = await client.get({
    name: true,
    $list: {
      $find: {
        $traverse: 'descendants',
        $filter: [
          {
            $field: 'ancestors',
            $operator: 'has',
            $value: regions[0],
          },
          {
            $field: 'type',
            $operator: '=',
            $value: 'team',
          },
        ],
      },
    },
  })

  deepEqualIgnoreOrder(
    t,
    dutchteams,
    [
      { name: 'team region 5' },
      { name: 'team region 4' },
      { name: 'team region 3' },
      { name: 'team region 2' },
      { name: 'team region 1' },
      { name: 'team region 0' },
    ],
    'dutch teams'
  )
})
