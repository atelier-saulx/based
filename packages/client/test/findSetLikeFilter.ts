import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
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
      ].map((c) => t.context.client.set(c))
    )
    await t.context.client.set({
      type: 'match',
      $id: `ma${i}`,
      value: i,
      parents: [`le${i % 15}`],
      children: childrenIds,
    })
  }

  for (let i = 1; i <= 50; i++) {
    const mascotId = await t.context.client.set({
      type: 'mascot',
      $id: `rq${i}`,
      name: ['Matt', 'Jim', 'Kord'][(i - 1) % 3],
    })
    await t.context.client.set({
      $id: `te${i}`,
      mascot: mascotId,
    })
  }
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('filter by descendants', async (t) => {
  const { client } = t.context
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

test('filter by parents', async (t) => {
  const { client } = t.context
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

test('set like match to reference', async (t) => {
  const { client } = t.context
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
