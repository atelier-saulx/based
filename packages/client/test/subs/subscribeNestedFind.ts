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

// TODO: rpn evaluation issue??
test.serial.only('get - correct order', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
    types: {
      folder: {
        prefix: 'fl',
        fields: {
          name: { type: 'string' },
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
      region: {
        prefix: 're',
        fields: {
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
    },
  })

  await client.set({
    $id: 'root',
    $language: 'en',
    children: [
      {
        type: 'folder',
        title: 'stuff',
        children: [
          {
            $id: 'ma1',
            title: 'match 1',
            published: true,
          },
          {
            $id: 'ma2',
            title: 'match 2',
            published: true,
          },
          {
            $id: 'ma3',
            title: 'match 3',
            published: true,
          },
          {
            $id: 'ma4',
            title: 'match 4',
            published: false,
          },
        ],
      },
      {
        type: 'region',
        $id: 're1',
        title: 'duitsland',
        published: true,
        children: [
          {
            type: 'folder',
            name: 'Highlights',
            published: true,
            children: ['ma1', 'ma2', 'ma3', 'ma4'],
          },
        ],
      },
    ],
  })

  const obs = {
    $id: 're1',
    children: {
      title: true,
      published: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'folder',
            },
            {
              $field: 'name',
              $operator: '=',
              $value: 'Highlights',
            },
          ],
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'published',
                $operator: '=',
                $value: true,
              },
            ],
          },
        },
        $limit: 8,
      },
    },
  }

  const results: any[] = []

  observe(t, obs, (v) => {
    results.push(v)
  })

  console.log('1', await client.command('subscriptions.list', []))
  await client.set({ $id: 'ma1', published: false })

  await wait(1e3)
  console.log('2', await client.command('subscriptions.list', []))

  await client.set({ $id: 'ma1', published: true })

  await wait(3e3)
  console.log('3', await client.command('subscriptions.list', []))

  t.is(results.length, 3)
  t.is(results[0].children.length, 3)
  t.is(results[1].children.length, 2)
  t.is(results[2].children.length, 3)

  t.pass()
})
