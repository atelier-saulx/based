import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
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

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: $add not implemented
// message: 'value.$add.map is not a function'
test.serial.skip('find - ancestors - regions', async (t) => {
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
              $operator: '=',
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

  t.deepEqual(
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

// TODO: $add not implemented
// message: 'value.$add.map is not a function'
test.serial.skip('find - ancestors - regions - no wrapping', async (t) => {
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
            $operator: '=',
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

  t.deepEqualIgnoreOrder(
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
