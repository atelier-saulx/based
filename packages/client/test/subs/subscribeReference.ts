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

//TODO: $language with subscription is somehow off?
test.serial.skip('subscription to a reference', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.updateSchema({
    languages: ['en'],
    types: {
      sport: {
        prefix: 'sp',
        fields: {
          title: { type: 'text' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          venue: { type: 'reference' },
        },
      },
      venue: {
        prefix: 've',
        fields: {
          title: { type: 'text' },
          description: { type: 'text' },
          seats: { type: 'references' },
        },
      },
      seat: {
        prefix: 'se',
        fields: {
          color: { type: 'text' },
        },
      },
    },
  })

  const menuItem = await client.set({
    $id: 'ma1',
    $language: 'en',
    type: 'match',
    title: 'menu item',
  })
  const sport = await client.set({
    $id: 'sp1',
    $language: 'en',
    type: 'sport',
    title: 'football',
  })
  const seat1 = await client.set({
    $id: 'se1',
    $language: 'en',
    type: 'seat',
    color: 'white',
  })
  const seat2 = await client.set({
    $id: 'se2',
    $language: 'en',
    type: 'seat',
    color: 'red',
  })
  const venue = await client.set({
    $id: 've1',
    $language: 'en',
    type: 'venue',
    title: 'Ipurua Stadium',
    seats: [seat1],
  })
  const venue2 = await client.set({
    $id: 've2',
    $language: 'en',
    type: 'venue',
    title: 'Fake Ipurua Stadium',
    seats: [],
  })
  const match = await client.set({
    $id: 'ma2',
    $language: 'en',
    type: 'match',
    title: 'football match',
    parents: [sport],
  })

  let n = 0
  observe(
    t,
    {
      $id: match,
      $language: 'en',
      title: true,
      venue: {
        title: true,
        seats: true,
      },
    },
    (v) => {
      console.log('got', v)
      switch (n++) {
        case 0:
          t.deepEqualIgnoreOrder(v, { title: 'football match' })
          break
        case 1:
          t.deepEqualIgnoreOrder(v, {
            title: 'football match',
            venue: { title: 'Ipurua Stadium', seats: [seat1] },
          })
          break
        case 2:
          t.deepEqualIgnoreOrder(v, {
            title: 'football match',
            venue: { title: 'Ipurua Stadium', seats: [seat1, seat2] },
          })
          break
        case 3:
          t.deepEqual(v, {
            title: 'football match',
            venue: {
              seats: [],
              title: 'Fake Ipurua Stadium',
            },
          })
          break
        default:
          t.fail()
      }
    }
  )
  await wait(1e3)

  await client.set({
    $id: match,
    venue: venue,
  })
  await wait(1e3)
  await client.set({
    $id: venue,
    seats: { $add: [seat2] },
  })

  await wait(1e3)
  await client.set({
    $id: match,
    venue: venue2,
  })
  await wait(1e3)
  t.deepEqual(n, 4, 'All change events received')
})
