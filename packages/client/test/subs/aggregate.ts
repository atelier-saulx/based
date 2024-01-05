import { basicTest, deepEqualIgnoreOrder } from '../assertions/index.js'
import { subscribe } from '@based/db-subs'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    league: {
      prefix: 'le',
      fields: {
        name: { type: 'string' },
        thing: { type: 'string' },
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
      },
    },
  },
})

test('simple count aggregate sub', async (t) => {
  // simple nested - single query
  const client = t.context.client

  t.plan(3)

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
  }

  await client.set({
    type: 'match',
    name: 'match 999',
  })

  let i = 0
  subscribe(
    client,
    {
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
    },
    (x: any) => {
      if (i === 0) {
        deepEqualIgnoreOrder(t, x, { id: 'root', matchCount: 4 })
      } else if (i === 1) {
        deepEqualIgnoreOrder(t, x, { id: 'root', matchCount: 5 })
      } else if (i === 2) {
        deepEqualIgnoreOrder(t, x, { id: 'root', matchCount: 8 })
      } else {
        t.fail()
      }
      i++
    }
  )

  await wait(1e3)

  await client.set({
    $id: 'ma10',
    parents: ['le1'],
    type: 'match',
    name: 'match 10',
    value: 72,
  })

  await wait(1e3)

  await Promise.all([
    client.set({
      $id: 'ma11',
      parents: ['le2'],
      type: 'match',
      name: 'match 11',
      value: 73,
    }),
    client.set({
      $id: 'ma12',
      parents: ['le1'],
      type: 'match',
      name: 'match 12',
      value: 74,
    }),
    client.set({
      $id: 'ma13',
      parents: ['le2'],
      type: 'match',
      name: 'match 13',
      value: 75,
    }),
  ])

  await wait(2e3)
})

test('simple sum aggregate sub', async (t) => {
  // simple nested - single query
  const client = t.context.client

  t.plan(3)

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

  let i = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      thing: {
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
    },
    (x: any) => {
      if (i === 0) {
        deepEqualIgnoreOrder(t, x, { id: 'root', thing: sum })
      } else if (i === 1) {
        deepEqualIgnoreOrder(t, x, { id: 'root', thing: sum + 72 })
      } else if (i < 4) {
        // skip
      } else if (i === 4) {
        deepEqualIgnoreOrder(t, x, {
          id: 'root',
          thing: sum + 72 + 73 + 74 + 75,
        })
      } else {
        t.fail()
      }
      i++
    }
  )

  await wait(1e3)

  await client.set({
    $id: 'ma10',
    parents: ['le1'],
    type: 'match',
    name: 'match 10',
    value: 72,
  })

  await wait(1e3)

  await client.set({
    $id: 'ma11',
    parents: ['le2'],
    type: 'match',
    name: 'match 11',
    value: 73,
  })
  await wait(500)
  await client.set({
    $id: 'ma12',
    parents: ['le1'],
    type: 'match',
    name: 'match 12',
    value: 74,
  })
  await wait(500)
  await client.set({
    $id: 'ma13',
    parents: ['le2'],
    type: 'match',
    name: 'match 13',
    value: 75,
  })
  await wait(2e3)
})

test('list avg aggregate sub', async (t) => {
  // simple nested - single query
  const client = t.context.client

  t.plan(3)

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
  }

  await client.set({
    type: 'match',
    name: 'match 999',
  })

  let i = 0
  subscribe(
    client,
    {
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
    },
    (x: any) => {
      if (i === 0) {
        t.deepEqual(x, {
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
        })
      } else if (i === 1) {
        t.deepEqual(x, {
          id: 'root',
          leagues: [
            {
              name: 'league 0',
              valueAvg: (10 + 12) / 2,
            },
            {
              name: 'league 1',
              valueAvg: (11 + 13 + 72) / 3,
            },
          ],
        })
      } else if (i <= 3) {
        // skip, only evaluate update from last of 3 sets
      } else if (i === 4) {
        t.deepEqual(x, {
          id: 'root',
          leagues: [
            {
              name: 'league 0',
              valueAvg: (10 + 12 + 73 + 75) / 4,
            },
            {
              name: 'league 1',
              valueAvg: (11 + 13 + 72 + 74) / 4,
            },
          ],
        })
      } else {
        t.fail()
      }
      i++
    }
  )

  await wait(1e3)

  await client.set({
    $id: 'ma10',
    parents: ['le1'],
    type: 'match',
    name: 'match 10',
    value: 72,
  })

  await wait(2e3)

  await client.set({
    $id: 'ma11',
    parents: ['le0'],
    type: 'match',
    name: 'match 11',
    value: 73,
  })
  await wait(1e3)
  await client.set({
    $id: 'ma12',
    parents: ['le1'],
    type: 'match',
    name: 'match 12',
    value: 74,
  })
  await wait(1e3)

  await client.set({
    $id: 'ma13',
    parents: ['le0'],
    type: 'match',
    name: 'match 13',
    value: 75,
  })

  await wait(1e3)
})

test('simple nested find avg aggregate sub', async (t) => {
  // simple nested - single query
  const client = t.context.client

  t.plan(3)

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

  let i = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      thing: {
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
    },
    (x: any) => {
      if (i === 0) {
        deepEqualIgnoreOrder(t, x, { id: 'root', thing: sum / 4 })
      } else if (i === 1) {
        deepEqualIgnoreOrder(t, x, { id: 'root', thing: (sum + 72) / 5 })
      } else if (i === 2) {
        // skip
      } else if (i === 3) {
        // skip
      } else if (i === 4) {
        deepEqualIgnoreOrder(t, x, {
          id: 'root',
          thing: (sum + 72 + 73 + 74 + 75) / 8,
        })
      } else {
        t.fail()
      }
      i++
    }
  )

  await wait(1e3)
  // const subs = await client.command('subscriptions.list', [])
  // const mrks = subs.flat(1).map(([sub]) => sub)
  // BigInt.prototype.toJSON = function() { return this.toString() }

  await client.set({
    $id: 'ma10',
    parents: ['le1'],
    type: 'match',
    name: 'match 10',
    value: 72,
  })

  await wait(1e3)

  await client.set({
    $id: 'ma11',
    parents: ['le2'],
    type: 'match',
    name: 'match 11',
    value: 73,
  })
  await wait(500)
  await client.set({
    $id: 'ma12',
    parents: ['le1'],
    type: 'match',
    name: 'match 12',
    value: 74,
  })
  await wait(500)
  await client.set({
    $id: 'ma13',
    parents: ['le2'],
    type: 'match',
    name: 'match 13',
    value: 75,
  })

  await wait(1e3)
})

test('simple max aggregate sub', async (t) => {
  // simple nested - single query
  const client = t.context.client

  t.plan(3)

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
  }

  await client.set({
    type: 'match',
    name: 'match 999',
  })

  let i = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      val: {
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
    },
    (x: any) => {
      if (i === 0) {
        deepEqualIgnoreOrder(t, x, { id: 'root', val: 13 })
      } else if (i === 1) {
        deepEqualIgnoreOrder(t, x, { id: 'root', val: 72 })
      } else if (i === 2) {
        deepEqualIgnoreOrder(t, x, { id: 'root', val: 75 })
      } else {
        t.fail()
      }
      i++
    }
  )

  await wait(1e3)

  await client.set({
    $id: 'ma10',
    parents: ['le1'],
    type: 'match',
    name: 'match 10',
    value: 72,
  })

  await wait(1e3)

  await Promise.all([
    client.set({
      $id: 'ma11',
      parents: ['le2'],
      type: 'match',
      name: 'match 11',
      value: 73,
    }),
    client.set({
      $id: 'ma12',
      parents: ['le1'],
      type: 'match',
      name: 'match 12',
      value: 74,
    }),
    client.set({
      $id: 'ma13',
      parents: ['le2'],
      type: 'match',
      name: 'match 13',
      value: 75,
    }),
  ])

  await wait(3e3)
})
