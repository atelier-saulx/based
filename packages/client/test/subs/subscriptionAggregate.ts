import anyTest, { ExecutionContext, TestInterface } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '@based/client'
import {
  SubsClient,
  createServerSettings,
  createPollerSettings,
} from '@based/db-subs'
import { BasedDbClient } from '@based/db-client'
import { SelvaServer, startOrigin } from '@based/db-server'
import getPort from 'get-port'
import { wait } from '@saulx/utils'
import '../assertions'

type TestCtx = {
  srv: SelvaServer
  subClient: SubsClient
  dbClient: BasedDbClient
  pollerClient: BasedClient
  port: number
}

const test = anyTest as TestInterface<TestCtx>

const startPoller = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  t.context.port = port
  const server = new BasedServer({
    ...createPollerSettings(),
    port,
  })

  await server.start()

  const client = new BasedClient({
    url: `ws://localhost:${port}`,
  })

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })

  t.context.pollerClient = client
}

const startDb = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  t.context.srv = await startOrigin({
    name: 'default',
    port,
  })
  t.context.dbClient = new BasedDbClient()
  t.context.dbClient.connect({ port, host: '127.0.0.1' })

  t.teardown(async () => {
    await t.context.srv.destroy()
    t.context.dbClient.destroy()
  })
}

const startServer = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  const server = new BasedServer({
    ...createServerSettings(
      t.context.pollerClient,
      () => {
        return t.context.dbClient
      },
      `ws://localhost:${port}`
    ),
    port,
  })
  await server.start()
  const client = new SubsClient(t.context.pollerClient)
  t.context.subClient = client

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })
}

const start = async (t: ExecutionContext<TestCtx>) => {
  await startPoller(t)
  await startDb(t)
  await startServer(t)

  await updateSchema(t)
}

const observe = async (
  t: ExecutionContext<TestCtx>,
  q: any,
  cb: (d: any) => void
) => {
  const { subClient } = t.context
  const id = subClient.subscribe('db', q, cb)
  return id
}

async function updateSchema(t: ExecutionContext<TestCtx>) {
  await t.context.dbClient.updateSchema({
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
}
test.serial('simple count aggregate sub', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (x) => {
      if (i === 0) {
        t.deepEqualIgnoreOrder(x, { id: 'root', matchCount: 4 })
      } else if (i === 1) {
        t.deepEqualIgnoreOrder(x, { id: 'root', matchCount: 5 })
      } else if (i === 2) {
        t.deepEqualIgnoreOrder(x, { id: 'root', matchCount: 8 })
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

test.serial('simple sum aggregate sub', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (x) => {
      if (i === 0) {
        t.deepEqualIgnoreOrder(x, { id: 'root', thing: sum })
      } else if (i === 1) {
        t.deepEqualIgnoreOrder(x, { id: 'root', thing: sum + 72 })
      } else if (i === 2) {
        t.deepEqualIgnoreOrder(x, {
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

test.serial('list avg aggregate sub', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (x) => {
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

  await Promise.all([
    client.set({
      $id: 'ma11',
      parents: ['le0'],
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
  ])

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

// TODO: aggregate with nested find wrong marker?
test.serial.skip('simple nested find avg aggregate sub', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (x) => {
      if (i === 0) {
        t.deepEqualIgnoreOrder(x, { id: 'root', thing: sum / 4 })
      } else if (i === 1) {
        t.deepEqualIgnoreOrder(x, { id: 'root', thing: (sum + 72) / 5 })
      } else if (i === 2) {
        t.deepEqualIgnoreOrder(x, {
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
  //const subs = await client.redis.selva_subscriptions_list('___selva_hierarchy')
  //for (const sub of subs) {
  //  console.log(await client.redis.selva_subscriptions_debug('___selva_hierarchy', sub))
  //}

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

test.serial('simple max aggregate sub', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (x) => {
      if (i === 0) {
        t.deepEqualIgnoreOrder(x, { id: 'root', val: 13 })
      } else if (i === 1) {
        t.deepEqualIgnoreOrder(x, { id: 'root', val: 72 })
      } else if (i === 2) {
        t.deepEqualIgnoreOrder(x, { id: 'root', val: 75 })
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
