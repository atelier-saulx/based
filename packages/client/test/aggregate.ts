import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions'

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
      prefix: 'ro',
      fields: {
        id: { type: 'string' },
      },
    },
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

test('simple aggregate', async (t) => {
  const { client } = t.context
  // simple nested - single query
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

  for (let i = 0; i < 4; i++) {
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

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      matchCount: {
        $aggregate: {
          $function: 'count',
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
    { id: 'root', matchCount: 4 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueSum: {
        $aggregate: {
          $function: { $name: 'sum', $args: ['value'] },
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
    { id: 'root', valueSum: sum }
  )

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
    { id: 'root', valueAvg: sum / 4 }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      leagues: {
        name: true,
        valueAvg: {
          $aggregate: {
            $function: { $name: 'avg', $args: ['value'] },
            $traverse: 'children',
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
        $list: {
          $find: {
            $traverse: 'children',
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
    }),
    {
      id: 'root',
      leagues: [
        {
          name: 'league 0',
          valueAvg: (10 + 12) / 2,
        },
        {
          name: 'league 1',
          valueAvg: (11 + 13) / 2,
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: ['ma1', 'ma2', 'ma3'],
        },
      },
    }),
    {
      id: 'root',
      valueAvg: (11 + 12 + 13) / 3,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: 'children',
          $find: {
            $traverse: 'children',
          },
        },
      },
    }),
    {
      id: 'root',
      valueAvg: sum / 4,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
          $find: {
            $traverse: 'children',
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
    }),
    {
      id: 'root',
      valueAvg: sum / 4,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'min', $args: ['value'] },
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
    { id: 'root', value: 10 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'max', $args: ['value'] },
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
    { id: 'root', value: 13 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'countUnique', $args: ['value'] },
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
    { id: 'root', value: 4 }
  )
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'countUnique', $args: ['type'] },
          $traverse: 'descendants',
        },
      },
    }),
    { id: 'root', value: 2 }
  )
})

test('simple aggregate with reference fields', async (t) => {
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

  for (let i = 0; i < 4; i++) {
    await client.set({
      $id: 'ma' + i,
      league: `le${i % 2}`,
      type: 'match',
      name: `match ${i}`,
      value: i + 10,
    })

    sum += (i % 2) * (i + 10)
  }

  console.log(
    'helloo',
    JSON.stringify(
      await client.get({
        things: {
          id: true,
          matches: true,
          $list: {
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
      }),
      null,
      2
    )
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'le1',
      id: true,
      valueSum: {
        $aggregate: {
          $function: { $name: 'sum', $args: ['value'] },
          $traverse: 'matches',
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
    { id: 'le1', valueSum: sum }
  )
})

test('sorted aggregate', async (t) => {
  const { client } = t.context
  // simple nested - single query
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

  for (let i = 0; i < 40; i++) {
    await client.set({
      $id: 'ma' + i,
      parents: [`le${i % 2}`],
      type: 'match',
      name: `match ${i}`,
      value: i + 10,
    })
  }

  await client.set({
    type: 'match',
    name: 'match 999',
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      matchCount: {
        $aggregate: {
          $function: 'count',
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
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    { id: 'root', matchCount: 4 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueSum: {
        $aggregate: {
          $function: { $name: 'sum', $args: ['value'] },
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
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    { id: 'root', valueSum: 46 }
  )

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
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    { id: 'root', valueAvg: 46 / 4 }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: ['ma1', 'ma2', 'ma3'],
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    {
      id: 'root',
      valueAvg: (11 + 12 + 13) / 3,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: 'children',
          $find: {
            $traverse: 'children',
          },
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    {
      id: 'root',
      valueAvg: 46 / 4,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      valueAvg: {
        $aggregate: {
          $function: { $name: 'avg', $args: ['value'] },
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
          ],
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
          $sort: {
            $order: 'desc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    {
      id: 'root',
      valueAvg: 190 / 4,
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'min', $args: ['value'] },
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
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    { id: 'root', value: 10 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      id: true,
      value: {
        $aggregate: {
          $function: { $name: 'max', $args: ['value'] },
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
          $sort: {
            $order: 'asc',
            $field: 'value',
          },
          $limit: 4,
        },
      },
    }),
    { id: 'root', value: 13 }
  )
})
