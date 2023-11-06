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
    languages: ['en'],
    types: {
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
        },
      },
    },
  })
}

test.serial('verify missing markers', async (t) => {
  await start(t)
  const client = t.context.dbClient

  //let res: any
  //observe(
  //  t,
  //  {
  //    $id: 'ma1',
  //    id: true,
  //    value: true,
  //  },
  //  (v) => {
  //    res = v
  //  }
  //)

  // TODO Remove
  await client.command('resolve.nodeid', [1, 'ma1'])

  await wait(100)
  const mMarkersBefore = await client.command('subscriptions.list', 2)
  console.log('missingMarkersBefore:', mMarkersBefore);
  console.log(await client.command('modify', ['ma1', '', ['0', 'field', 'hello']]))
  //await client.set({
  //  $id: 'ma1',
  //  type: 'match',
  //  //value: 5, TODO crash
  //})
  await wait(100)
  const mMarkersAfter = await client.command('subscriptions.list', 2)
  console.log('missingMarkersAfter:', mMarkersAfter);

  // TODO
  //t.deepEqual(res, { id: 'ma1', value: 5 })
  console.log(await client.get({ $id: 'ma1', id: true, value: true }))
  console.log(await client.command('object.get', ['', 'ma1']))
})
