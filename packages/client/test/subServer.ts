import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '@based/client'
import {
  SubsClient,
  createServerSettings,
  createPollerSettings,
} from '@based/db-subs'
import { BasedDbClient } from '@based/db-client'
import { startOrigin } from '@based/db-server'
import getPort from 'get-port'
import { wait } from '@saulx/utils'

const startPoller = async (t: ExecutionContext<unknown>) => {
  const port = await getPort()
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

  return client
}

const startDb = async (t: ExecutionContext<unknown>) => {
  const port = await getPort()
  const server = await startOrigin({ name: 'default', port })
  const client = new BasedDbClient()
  client.connect({ port, host: '127.0.0.1' })

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })

  return client
}

const startServer = async (
  t: ExecutionContext<unknown>,
  pollerClient: BasedClient,
  dbClient: BasedDbClient
) => {
  const port = await getPort()
  const server = new BasedServer({
    ...createServerSettings(
      pollerClient,
      () => {
        return dbClient
      },
      `ws://localhost:${port}`
    ),
    port,
  })
  await server.start()
  const client = new SubsClient(pollerClient)

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })

  return client
}

const start = async (t) => {
  const pollerClient = await startPoller(t)
  const dbClient = await startDb(t)
  const subClient = await startServer(t, pollerClient, dbClient)
  return { subClient, dbClient }
}

const testSubscription = async (
  t,
  subClient: SubsClient,
  dbClient: BasedDbClient,
  schema: Parameters<BasedDbClient['updateSchema']>[0],
  query: Parameters<BasedDbClient['get']>[0],
  updates: Parameters<BasedDbClient['set']>[0][],
  results: Record<string, any>[]
) => {
  if (schema) {
    await dbClient.updateSchema(schema)
  }

  const initialUpdate = updates.shift()
  if (initialUpdate) {
    await dbClient.set(initialUpdate)
    await wait(500)
  }
  await new Promise<void>((resolve) => {
    const id = subClient.subscribe(
      'db',
      query,
      async function listener(result) {
        const expected = results.shift()
        if (expected) {
          t.deepEqual(result, expected)
        }

        const update = updates.shift()
        if (update) {
          await dbClient.set(update).catch(console.error)
        }

        if (!results.length && !updates.length) {
          subClient.unsubscribe(id, listener)
          resolve()
        }
      }
    )
  })
}

test('subscribe to children', async (t) => {
  const { subClient, dbClient } = await start(t)
  await testSubscription(
    t,
    subClient,
    dbClient,
    {
      types: {
        tester: {
          prefix: 'te',
          fields: {
            name: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      $id: 'root',
      children: {
        id: true,
        name: true,
        $list: true,
      },
    },
    [
      null,
      {
        $id: 'te1',
        name: 'aaa',
      },
      {
        $id: 'te2',
        name: 'bbb',
      },
      {
        $id: 'te3',
        name: 'ccc',
      },
    ],
    [
      {},
      {
        children: [{ id: 'te1', name: 'aaa' }],
      },
      {
        children: [
          { id: 'te1', name: 'aaa' },
          {
            id: 'te2',
            name: 'bbb',
          },
        ],
      },
      {
        children: [
          { id: 'te1', name: 'aaa' },
          {
            id: 'te2',
            name: 'bbb',
          },
          {
            id: 'te3',
            name: 'ccc',
          },
        ],
      },
    ]
  )
})

test.skip('subscribe to parents', async (t) => {
  const { subClient, dbClient } = await start(t)
  await testSubscription(
    t,
    subClient,
    dbClient,
    {
      types: {
        tester: {
          prefix: 'te',
          fields: {
            name: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      $id: 'te1',
      parents: {
        id: true,
        name: true,
        $list: true,
      },
    },
    [
      {
        $id: 'te1',
        name: 'aaa',
      },
      {
        $id: 'te2',
        name: 'bbb',
        children: ['te1'],
      },
      {
        $id: 'te3',
        name: 'ccc',
        children: ['te1'],
      },
    ],
    [
      {
        parents: [
          {
            id: 'root',
          },
        ],
      },
      {
        parents: [
          {
            id: 'root',
          },
          {
            id: 'te2',
            name: 'bbb',
          },
        ],
      },
      {
        parents: [
          {
            id: 'root',
          },
          {
            id: 'te2',
            name: 'bbb',
          },
          {
            id: 'te3',
            name: 'ccc',
          },
        ],
      },
    ]
  )
})
