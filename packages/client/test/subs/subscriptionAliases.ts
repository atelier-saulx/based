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

async function updateSchema(t: ExecutionContext<TestCtx>) {}

test.serial.skip(
  'changing alias to another node fires subscription',
  async (t) => {
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

    await client.set({
      $id: 'yebba',
      yesh: 'pretty nice',
      aliases: { $add: 'hello-friend' },
    })

    let o1counter = 0
    observe(
      t,
      {
        $alias: 'hello-friend',
        yesh: true,
      },
      (d) => {
        if (o1counter === 0) {
          // gets start event
          t.is(d.yesh, 'pretty nice')
        } else if (o1counter === 1) {
          // gets update event
          t.deepEqualIgnoreOrder(d, { yesh: 'extra nice' })
        } else {
          // doesn't get any more events
          t.fail()
        }
        o1counter++
      }
    )

    await wait(500 * 2)

    await client.set({
      $id: 'yebbe',
      yesh: 'extra nice',
      aliases: { $add: 'hello-friend' },
    })

    await wait(500 * 2)
  }
)
