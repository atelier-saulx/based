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
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          matches: { type: 'references' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          matchType: { type: 'string' },
          date: { type: 'number' },
          completedAt: { type: 'number' },
        },
      },
    },
  })
}

// TODO: Adding to references not triggering subscription callback
// working fine with a get
test.serial('add new reference', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const league = await client.set({
    type: 'league',
    name: 'Best',
  })

  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma1',
          type: 'match',
          matchType: 'interesting',
          date: 1,
        },
      ],
    },
  })

  let res: any
  observe(
    t,
    {
      $id: league,
      ongoing: {
        id: true,
        $list: {
          $find: {
            $traverse: 'matches',
            $filter: {
              $field: 'matchType',
              $operator: '=',
              $value: 'interesting',
              $and: {
                $field: 'completedAt',
                $operator: 'notExists',
              },
            },
          },
        },
      },
    },
    (v) => {
      res = v
    }
  )

  await wait(100)
  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma2',
          type: 'match',
          matchType: 'interesting',
          date: 2,
        },
      ],
    },
  })
  await wait(100)
  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma3',
          date: 2,
          matchType: 'interesting',
          completedAt: 3,
        },
      ],
    },
  })
  await wait(100)
  await client.set({
    $id: 'ma3',
    completedAt: { $delete: true },
  })
  await wait(100)

  //const subs = await client.redis.selva_subscriptions_list('___selva_hierarchy')
  //console.log(subs)
  //console.log(await client.redis.selva_subscriptions_debug('___selva_hierarchy', subs[0]))
  //console.log('ma1', await client.command('subscriptions.debug', ['ma1']))
  //console.log('ma2', await client.command('subscriptions.debug', ['ma2']))
  //console.log('ma3', await client.command('subscriptions.debug', ['ma3']))

  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma2' }, { id: 'ma3' }] })

  await client.delete({ $id: 'ma2' })
  await wait(100)
  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma3' }] })
})
