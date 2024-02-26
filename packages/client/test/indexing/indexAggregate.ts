import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import { getIndexingState } from '../assertions/utils.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from '../assertions/index.js'

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
    env: {
      SELVA_INDEX_MAX: '100',
      SELVA_INDEX_INTERVAL: '1000',
      SELVA_INDEX_ICB_UPDATE_INTERVAL: '500',
      SELVA_INDEX_POPULARITY_AVE_PERIOD: '3',
    },
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
          matches: {
            type: 'references',
            bidirectional: { fromField: 'league' },
          },
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
          league: {
            type: 'reference',
            bidirectional: { fromField: 'matches' },
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

test('simple aggregate with indexing', async (t) => {
  const { client } = t.context
  let sum = 0

  await Promise.all([
    await client.set({
      $id: 'le0',
      name: `league 0`,
    }),
    await client.set({
      $id: 'le1',
      name: `league 1`,
    }),
  ])

  for (let i = 0; i < 4000; i++) {
    await client.set({
      $id: 'ma' + i,
      parents: [`le${i % 2}`],
      type: 'match',
      name: `match ${i}`,
      value: i + 10,
    })

    sum += i + 10
  }

  await client.set({
    type: 'match',
    name: 'match 999',
  })

  for (let i = 0; i < 30; i++) {
    deepEqualIgnoreOrder(
      t,
      await client.get({
        $id: 'root',
        id: true,
        valueAvg: {
          $aggregate: {
            $function: { $name: 'avg', $args: ['value'] },
            $traverse: 'descendants',
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
      }),
      { id: 'root', valueAvg: sum / 4000 }
    )

    await wait(300)
  }

  const indState = await getIndexingState(client)
  t.deepEqual(Object.keys(indState).length, 2)
  deepEqualIgnoreOrder(t, indState['root.J.Im1hIiBl'].card, 4001)
  deepEqualIgnoreOrder(t, indState['root.J.InZhbHVlIiBo'].card, 4000)
  t.truthy(Number(indState['root.J.InZhbHVlIiBo'].ind_take_max_ave) > 3000)
})
