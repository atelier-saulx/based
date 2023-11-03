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

test.serial('subscribing to all fields', async (t) => {
  await start(t)
  const client = t.context.dbClient
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      folder: {
        prefix: 'fo',
        fields: { title: { type: 'text' } },
      },
      match: {
        prefix: 'ma',
        fields: {
          published: { type: 'boolean' },
          buttonText: { type: 'text' },
        },
      },
    },
  })

  await client.set({
    $language: 'en',
    $id: 'fo1',
    children: [],
  })

  const get = {
    $id: 'fo1',
    $all: true,
    $language: 'en',
    children: {
      $list: true,
      $all: true,
    },
  }

  const results: any[] = []
  observe(t, get, (v: any) => {
    if (v.children[0]) {
      results.push(v.children[0].buttonText)
    }
  })

  client.set({
    $id: 'fo1',
    $language: 'en',
    children: [
      {
        $id: 'ma1',
        buttonText: 'my sallz',
      },
    ],
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sall',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sa',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sal',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallz',
  })

  await wait(100)

  client.set({
    $id: 'ma1',
    $language: 'en',
    buttonText: 'my sallzzzz',
  })

  await wait(100)

  t.deepEqual(results, [
    'my sallz',
    'my sall',
    'my sa',
    'my sal',
    'my sallz',
    'my sallzzzz',
  ])
})
