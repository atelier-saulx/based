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
import { deepCopy, wait } from '@saulx/utils'
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

async function updateSchema(t: ExecutionContext<TestCtx>) {}

// TODO: inherit op on non-existing doesn't inherit from root
test.serial.skip('inherit object nested field from root youzi', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        flapper: {
          type: 'object',
          properties: {
            snurk: { type: 'json' },
            bob: { type: 'json' },
          },
        },
      },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          flapper: {
            type: 'object',
            properties: {
              snurk: { type: 'json' },
              bob: { type: 'json' },
            },
          },
        },
      },
    },
  })
  await wait(100)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  await client.set({
    $id: 'yeA',
  })

  const results: any[] = []
  observe(
    t,
    {
      $id: 'yeA',
      flapper: { snurk: { $inherit: true } },
    },
    (p) => {
      // its now not immatable - think about if we want it immutable
      results.push(deepCopy(p))
    }
  )

  await wait(2000)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(2000)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello' } },
    { flapper: { snurk: 'snurkels' } },
  ])

  t.true(true)
})

test.serial('inherit object youzi', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          flapper: {
            type: 'object',
            properties: {
              snurk: { type: 'json' },
              bob: { type: 'json' },
            },
          },
        },
      },
    },
  })
  await wait(100)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  const results: any[] = []
  observe(
    t,
    {
      $id: 'yeA',
      flapper: { $inherit: { $type: 'yeshType' } },
    },
    (p) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(1000)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello', bob: 'xxx' } },
    { flapper: { snurk: 'snurkels', bob: 'xxx' } },
  ])
})

// TODO: inherit not triggering subscription. Get works fine
test.serial.only('basic inherit subscription', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        yesh: { type: 'string' },
        no: { type: 'string' },
        flapper: {
          type: 'object',
          properties: {
            snurk: { type: 'json' },
            bob: { type: 'json' },
          },
        },
      },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          yesh: { type: 'string' },
          flapper: {
            type: 'object',
            properties: {
              snurk: { type: 'json' },
              bob: { type: 'json' },
            },
          },
        },
      },
    },
  })
  await wait(100)

  await client.set({
    $id: 'root',
    yesh: 'yesh',
    no: 'no',
  })

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a',
  })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  const results: any = []

  observe(
    t,
    {
      $id: 'yeB',
      yesh: { $inherit: true },
    },
    (p) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  const subs = await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a!',
  })

  await wait(1000)

  await client.set({
    $id: 'yeB',
    yesh: 'yesh b',
  })

  await wait(1000)

  console.dir({ subs }, { depth: 8 })

  t.deepEqual(results, [
    { yesh: 'yesh a' },
    { yesh: 'yesh a!' },
    { yesh: 'yesh b' },
  ])
})

// TODO: $inherit with $type not working
test.serial.skip('inherit object', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        flapper: {
          type: 'object',
          properties: {
            snurk: { type: 'json' },
            bob: { type: 'json' },
          },
        },
      },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          flapper: {
            type: 'object',
            properties: {
              snurk: { type: 'json' },
              bob: { type: 'json' },
            },
          },
        },
      },
    },
  })
  await wait(100)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  // await client.set({
  //   $id: 'yeA'
  // })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  t.deepEqual(
    await client.get({
      $id: 'yeB',
      // TODO: should work without $type
      flapper: { $inherit: { $merge: true, $type: ['yeshType', 'root'] } },
    }),
    {
      flapper: {
        snurk: 'hello',
        bob: 'xxx',
      },
    }
  )

  const results: any = []
  observe(
    t,
    {
      $id: 'yeB',
      // TODO: should work without $type
      flapper: { $inherit: { $merge: true, $type: ['yeshType', 'root'] } },
    },
    (p) => {
      results.push(deepCopy(p))
    }
  )

  await wait(500)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(500)

  await client.set({
    $id: 'yeB',
    flapper: {
      snurk: 'power bro',
    },
  })

  await wait(500)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello', bob: 'xxx' } },
    { flapper: { snurk: 'snurkels', bob: 'xxx' } },
    { flapper: { snurk: 'power bro', bob: 'xxx' } },
  ])
})

// TODO: old com
