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
          title: { type: 'text' },
          name: { type: 'string' },
          value: { type: 'number' },
          status: { type: 'number' },
          date: { type: 'number' },
        },
      },
    },
  })
}

test.serial('subscription list', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const matches: any[] = []

  await wait(500)

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      name: 'match ' + i,
      type: 'match',
      value: i,
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(matches.map((v) => client.set(v)))

  await wait(500)

  const obs = {
    children: {
      name: true,
      id: true,
      $list: {},
    },
  }
  let cnt = 0
  observe(t, obs, (d) => {
    cnt++
  })

  await wait(1000)
  t.is(cnt, 1)

  client.set({
    $id: matches[0].$id,
    name: 'FLURP!',
  })

  await wait(1000)
  t.is(cnt, 2)

  const obs2 = {
    $language: 'en', // need this in my meta query
    title: true,
    children: {
      name: true,
      title: true,
      type: true,
      $list: {},
    },
  }

  const obs3 = {
    $language: 'en', // need this in my meta query, also need to use schema for this (adding lang field to text fields)
    title: true,
    items: {
      name: true,
      title: true,
      type: true,
      $list: {
        $find: {
          $traverse: 'children',
        },
      },
    },
  }

  let cnt2 = 0
  let cnt3 = 0
  observe(t, obs2, (d) => {
    cnt2++
  })

  observe(t, obs3, (d) => {
    cnt3++
  })

  await wait(2000)

  client.set({
    $id: matches[0].$id,
    title: { en: 'Flapdrol' },
  })

  await wait(2000)
  t.is(cnt3, 2)
  t.is(cnt2, 2)
})
