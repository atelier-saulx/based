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
    translations: ['de', 'nl'],
    types: {
      thing: {
        prefix: 'th',
        fields: {
          yesh: { type: 'number' },
          next: { type: 'reference' },
          things: { type: 'references' },
        },
      },
    },
  })
}

test.serial('subscribe and delete', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const q: any[] = []
  for (let i = 0; i < 10; i++) {
    q.push(
      client.set({
        type: 'thing',
        yesh: i,
      })
    )
  }

  const ids = await Promise.all(q)

  let cnt = 0
  observe(
    t,
    {
      $id: 'root',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (d) => {
      cnt++
    }
  )

  await wait(1000)

  await client.set({ type: 'thing', yesh: 2 })

  await wait(1000)

  await client.delete({ $id: ids[0] })

  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})

test.serial('subscribe and delete a descendant', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    children: [
      {
        type: 'thing',
        $id: 'th2',
        yesh: 2,
      },
    ],
  })

  t.plan(2)
  let i = 0

  observe(
    t,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v) => {
      switch (i++) {
        case 0:
          t.deepEqual(v, { items: [{ id: 'th2' }] })
          break
        case 1:
          t.deepEqual(v, { items: [] })
          break
      }
    }
  )

  await wait(100)
  await client.delete({ $id: 'th2' })
  await wait(100)
})

test.serial('subscribe and delete over a reference field', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    next: {
      type: 'thing',
      $id: 'th2',
      yesh: 2,
    },
  })

  t.plan(2)
  let i = 0
  observe(
    t,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'next',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v) => {
      switch (i++) {
        case 0:
          t.deepEqual(v, { items: [{ id: 'th2' }] })
          break
        case 1:
          t.deepEqual(v, { items: [] })
          break
      }
    }
  )

  await wait(100)
  await client.delete({ $id: 'th2' })
  await wait(100)
})

test.serial('subscribe and delete over references field', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const id = await client.set({
    type: 'thing',
    yesh: 1,
    things: [
      {
        type: 'thing',
        $id: 'th2',
        yesh: 2,
      },
      {
        type: 'thing',
        $id: 'th3',
        yesh: 3,
      },
    ],
  })

  t.plan(2)
  let i = 0
  observe(
    t,
    {
      $id: id,
      $language: 'en',
      items: {
        id: true,
        $list: {
          $limit: 1000,
          $offset: 0,
          $sort: {
            $field: 'createdAt',
            $order: 'desc',
          },
          $find: {
            $traverse: 'things',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            ],
          },
        },
      },
    },
    (v) => {
      switch (i++) {
        case 0:
          t.deepEqualIgnoreOrder(v, { items: [{ id: 'th2' }, { id: 'th3' }] })
          break
        case 1:
          t.deepEqual(v, { items: [{ id: 'th3' }] })
          break
      }
    }
  )

  await wait(100)
  await client.delete({ $id: 'th2' })
  await wait(100)
})

// TODO: subscribing on ids that don't exist
test.serial.skip('subscribe and delete one item', async (t) => {
  await start(t)
  const client = t.context.dbClient
  let cnt = 0
  observe(
    t,
    {
      $id: 'thing1',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (d) => {
      console.log('dddd', d)
      cnt++ // 1
    }
  )

  await wait(1000)

  const id = (await client.set({
    type: 'thing',
    yesh: 12,
    parents: ['thing1'],
  })) as string // 2
  await wait(1000)
  await client.delete({ $id: id }) // 3
  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})

test.serial('subscribe and delete one item: root', async (t) => {
  await start(t)
  const client = t.context.dbClient
  let cnt = 0
  observe(
    t,
    {
      $id: 'root',
      things: {
        id: true,
        yesh: true,
        $list: {
          $find: {
            $traverse: 'children', // also desc
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (d) => {
      cnt++ // 1
    }
  )

  await wait(1000)

  const id = (await client.set({
    type: 'thing',
    yesh: 12,
  })) as string // 2
  await wait(1000)
  await client.delete({ $id: id }) // 3
  await wait(1000)

  t.is(cnt, 3)

  await wait(1000)
})
