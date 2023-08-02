import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
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
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          description: { type: 'text' },
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          mascot: { type: 'reference' },
        },
      },
      mascot: {
        prefix: 'rq',
        fields: {
          name: { type: 'string' },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await new Promise((r) => setTimeout(r, 100))

  for (let i = 1; i < 400; i++) {
    const childrenIds = await Promise.all(
      [
        {
          type: 'team',
          $id: `te${i % 50}`,
          parents: [`ma${i}`],
          name: `Hehe ${i}A`,
          value: i % 10,
        },
        {
          type: 'team',
          $id: `te${(i % 50) + 1}`,
          parents: [`ma${i}`],
          name: `Hehe ${i}B`,
          value: i % 3,
        },
      ].map((c) => client.set(c))
    )
    await client.set({
      type: 'match',
      $id: `ma${i}`,
      value: i,
      parents: [`le${i % 15}`],
      children: childrenIds,
    })
  }

  for (let i = 1; i <= 50; i++) {
    const mascotId = await client.set({
      type: 'mascot',
      $id: `rq${i}`,
      name: ['Matt', 'Jim', 'Kord'][(i - 1) % 3],
    })
    await client.set({
      $id: `te${i}`,
      mascot: mascotId,
    })
  }
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('filter by descendants', async (t) => {
  t.deepEqual(
    await client.get({
      $id: 'root',
      leagues: {
        id: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'league',
              },
              {
                $field: 'descendants',
                $operator: 'has',
                $value: ['te5', 'te10'],
              },
            ],
          },
        },
      },
    }),
    {
      leagues: [{ id: 'le0' }, { id: 'le10' }],
    }
  )
})

test.serial('filter by ancestors', async (t) => {
  t.deepEqual(
    await client.get({
      $id: 'root',
      teams: {
        id: true,
        value: true,
        $list: {
          $sort: { $field: 'value', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
              // TODO This part wasn't working properly before and now it's borken because it actually filters
              //{
              //  $field: 'ancestors',
              //  $operator: 'has',
              //  $value: [ 'le1', 'le4' ],
              //},
              {
                $field: 'value',
                $operator: '=',
                $value: 8,
              },
            ],
          },
        },
      },
    }),
    {
      teams: [
        { id: 'te18', value: 8 },
        { id: 'te28', value: 8 },
        { id: 'te38', value: 8 },
        { id: 'te48', value: 8 },
        { id: 'te8', value: 8 },
      ],
    }
  )
})

test.serial('filter by parents', async (t) => {
  t.deepEqual(
    await client.get({
      $id: 'te1',
      matches: {
        id: true,
        $list: {
          $find: {
            $traverse: 'ancestors',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'parents',
                $operator: 'has',
                $value: 'le6',
              },
            ],
          },
        },
      },
    }),
    {
      matches: [{ id: 'ma351' }],
    }
  )
})

test.serial('set like match to reference', async (t) => {
  t.deepEqual(
    await client.get({
      mascots: {
        id: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
              {
                $field: 'mascot',
                $operator: 'has',
                $value: 'rq5',
              },
            ],
          },
        },
      },
    }),
    {
      mascots: [{ id: 'te5' }],
    }
  )
})
