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

test.serial('basic id based subscriptions', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: { yesh: { type: 'string' }, no: { type: 'string' } },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          yesh: { type: 'string' },
        },
      },
    },
  })

  t.plan(4)

  let o1counter = 0
  const sub1 = observe(t, { $id: 'root', yesh: true }, (d) => {
    if (o1counter === 0) {
      // gets start event
      t.is(d?.yesh, undefined)
    } else if (o1counter === 1) {
      // gets update event
      t.deepEqualIgnoreOrder(d, { yesh: 'so nice' })
    } else {
      // doesn't get any more events
      t.fail()
    }

    o1counter++
  })

  const thing = await client.set({
    type: 'yeshType',
    yesh: 'extra nice',
  })

  let o2counter = 0
  const sub2 = observe(t, { $id: thing, $all: true, aliases: false }, (d) => {
    if (o2counter === 0) {
      // gets start event
      t.deepEqualIgnoreOrder(d, {
        id: thing,
        type: 'yeshType',
        yesh: 'extra nice',
      })
    } else if (o2counter === 1) {
      // gets delete event
      t.deepEqualIgnoreOrder(d, {})
    } else {
      t.fail()
    }
    o2counter++
  })

  await wait(500 * 2)

  await client.set({
    $id: 'root',
    no: 'no event pls',
  })

  await client.set({
    $id: 'root',
    yesh: 'so nice',
  })

  await client.delete({
    $id: thing,
  })

  await wait(500 * 2)

  // sub.unsubscribe()
  // sub2.unsubscribe()

  await wait(500 * 2)
})

test.serial('basic id based nested query subscriptions', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: { yesh: { type: 'string' }, no: { type: 'string' } },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          yesh: { type: 'string' },
        },
      },
    },
  })

  t.plan(2)

  const thing = await client.set({
    type: 'yeshType',
    yesh: 'extra nice',
  })

  let o2counter = 0
  const other = observe(
    t,
    {
      $id: 'root',
      item: {
        $id: thing,
        $all: true,
        updatedAt: false,
        createdAt: false,
        aliases: false,
      },
    },
    (d) => {
      if (o2counter === 0) {
        // gets start event
        t.deepEqualIgnoreOrder(d, {
          item: {
            id: thing,
            type: 'yeshType',
            yesh: 'extra nice',
          },
        })
      } else if (o2counter === 1) {
        console.log('DD', d)
        // gets delete event
        t.deepEqualIgnoreOrder(d, {})
      } else {
        t.fail()
      }
      o2counter++
    }
  )

  await wait(500 * 2)

  await client.set({
    $id: 'root',
    no: 'no event pls',
  })

  await client.set({
    $id: 'root',
    yesh: 'so nice',
  })

  await client.delete({
    $id: thing,
  })

  await wait(500 * 2)
})
