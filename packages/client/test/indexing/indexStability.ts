import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import { getIndexingState } from '../assertions/utils.js'
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
    env: {
      FIND_INDICES_MAX: '2',
      FIND_INDEXING_INTERVAL: '1000',
      FIND_INDEXING_ICB_UPDATE_INTERVAL: '500',
      FIND_INDEXING_POPULARITY_AVE_PERIOD: '6',
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

test.skip('index stability', async (t) => {
  const { client } = t.context

  for (let i = 1; i < 400; i++) {
    await client.set({
      type: 'match',
      $id: `ma${i}`,
      value: i,
      parents: [`le${i % 5}`],
      children: [
        {
          type: 'team',
          $id: `te${i % 50}`,
          name: `Hehe ${i}A`,
          value: i % 10,
        },
        {
          type: 'team',
          $id: `te${(i % 50) + 1}`,
          name: `Hehe ${i}B`,
          value: i % 3,
        },
      ],
    })
  }

  const q1 = {
    // common
    $id: 'root',
    teams: {
      name: true,
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
              $field: 'value',
              $operator: '=',
              $value: 2,
            },
          ],
        },
      },
    },
  }
  const q2 = {
    // common
    $id: 'root',
    matches: {
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
              $value: 'match',
            },
          ],
        },
      },
    },
  }
  const q3 = {
    // semi rare
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
            {
              $field: 'value',
              $operator: '=',
              $value: 1,
            },
          ],
        },
      },
    },
  }
  const q4 = {
    // rare
    $id: 'root',
    leagues: {
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
              $value: 'league',
            },
          ],
        },
      },
    },
  }
  const q5 = {
    // rare
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
              $field: 'children',
              $operator: 'has',
              $value: ['ma1'],
            },
          ],
        },
      },
    },
  }

  const N = 5 * 60
  const P = Array(N)
    .fill(null)
    .map((_, i) => async () => {
      await client.get(q1)
      await client.get(q2)

      if (i % 5 == 0) {
        await client.get(q3)
      }
      if (i % 60 == 0) {
        await client.get(q4)
        await client.get(q5)
      }

      if (i % 60 == 0) {
        const stateMap = await getIndexingState(client)

        if (i >= 120) {
          t.deepEqual(stateMap['root.J.InRlIiBl']?.card, '51') // q1, q3
          t.deepEqual(stateMap['root.J.InZhbHVlIiBnICMyIEY=']?.card, '6') // q1
          t.deepEqual(
            stateMap['root.J.B.dmFsdWU=.Im1hIiBl']?.card,
            'not_active'
          ) // q2
          t.deepEqual(
            stateMap['root.J.B.dmFsdWU=.InZhbHVlIiBnICMxIEY=']?.card,
            'not_active'
          ) // q3
          t.deepEqual(stateMap['root.J.ImxlIiBl']?.card, 'not_active') // q4, q5
          t.deepEqual(
            stateMap['root.J.ImNoaWxkcmVuIiB7Im1hMSJ9IGw=']?.card,
            'not_active'
          ) // q5
        }
      }
    })

  for (let i = 0; i < P.length; i++) {
    t.notThrows(P[i])
    await wait(200)
  }
})
