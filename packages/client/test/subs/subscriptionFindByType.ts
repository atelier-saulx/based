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
          thing: { type: 'string' },
          matches: { type: 'references' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          description: { type: 'text' },
          value: {
            type: 'number',
          },
          status: { type: 'number' },
        },
      },
    },
  })
}

// TODO: Selva assertion fail
// Assertion failed: ((marker->dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD | SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD | SELVA_HIERARCHY_TRAVERSAL_FIELD | SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) && !(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_TRIGGER)), function marker_set_ref_field, file subscriptions.c, line 746.

test.serial.skip('subscription find by type', async (t) => {
  await start(t)
  const client = t.context.dbClient

  await client.set({
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $id: 'ma1',
    parents: ['le1'],
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    $id: 'ma2',
    parents: ['ma1'],
    type: 'match',
    name: 'match 2',
    value: 2,
  })

  await client.set({
    $id: 'ma3',
    parents: ['ma1'],
    type: 'match',
    name: 'match 3',
  })

  await client.set({
    $id: 'le1',
    matches: ['ma1', 'ma2', 'ma3'],
  })

  t.plan(3)

  let cnt1 = 0
  observe(
    t,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: 'children',
              $any: false,
            },
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    },
    (v) => {
      if (cnt1 === 0) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            // { name: 'match 2', nonsense: 'yes' },
          ],
        })
      } else {
        t.fail()
      }
      cnt1++
    }
  )

  let cnt2 = 0
  observe(
    t,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: { $first: ['matches', 'children'] },
              $any: false,
            },
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    },
    (v) => {
      if (cnt2 === 0) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            { name: 'match 2', nonsense: 'yes' },
          ],
        })
      } else if (cnt2 === 1) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            { name: 'match 2', nonsense: 'yes' },
            { name: 'match 4', nonsense: 'yes' },
          ],
        })
      } else {
        t.fail()
      }
      cnt2++
    }
  )

  await wait(2e3)

  console.log('-------- 1')
  await Promise.all([
    client.set({
      $id: 'ma4',
      parents: ['ma1'],
      type: 'match',
      name: 'match 4',
      value: 4,
    }),

    client.set({
      $id: 'le1',
      matches: { $add: 'ma4' },
    }),
  ])
  console.log('-------- 2')

  await wait(2e3)
})
