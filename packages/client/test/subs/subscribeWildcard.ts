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
    language: 'en',
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
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
          record: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                a: {
                  type: 'string',
                },
                b: {
                  type: 'string',
                },
                nestedRecord: {
                  type: 'record',
                  values: {
                    type: 'object',
                    properties: {
                      a: {
                        type: 'string',
                      },
                      b: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
          status: { type: 'number' },
        },
      },
    },
  })
}

test.serial('sub find - list with wildcard', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient
  await client.set({
    $id: 'ma1',
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {
      obj: {
        a: 'abba',
        b: 'babba',
        nestedRecord: {
          hello: {
            a: 'abba',
            b: 'babba',
          },
          yellow: {
            a: 'abba2',
            b: 'babba2',
          },
        },
      },
    },
  })

  await client.set({
    $id: 'ma2',
    type: 'match',
    name: 'match 2',
    value: 2,
    record: {
      obj: {
        a: '2_abba',
        b: '2_babba',
        nestedRecord: {
          hello: {
            a: '2_abba',
            b: '2_babba',
          },
          yellow: {
            a: '2_abba2',
            b: '2_babba2',
          },
        },
      },
    },
  })

  let cnt = 0
  observe(
    t,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        record: {
          '*': {
            a: true,
            b: true,
          },
        },
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    },
    (v) => {
      if (cnt === 0) {
        console.dir({ v }, { depth: 6 })
        t.deepEqual(v, {
          id: 'root',
          items: [
            {
              name: 'match 1',
              record: {
                obj: { a: 'abba', b: 'babba' },
              },
            },
            {
              name: 'match 2',
              record: {
                obj: { a: '2_abba', b: '2_babba' },
              },
            },
          ],
        })
      } else if (cnt === 1) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            {
              name: 'match 1',
              record: {
                obj: { a: 'abba', b: 'babba' },
                newObj: { a: 'new yes' },
              },
            },
            {
              name: 'match 2',
              record: {
                obj: { a: '2_abba', b: '2_babba' },
              },
            },
          ],
        })
      } else {
        t.fail()
      }

      cnt++
    }
  )

  await wait(1e3)

  t.deepEqual(cnt, 1)

  await client.set({
    $id: 'ma1',
    record: {
      newObj: {
        a: 'new yes',
      },
    },
  })

  await wait(1e3)

  t.deepEqual(cnt, 2)
})

test.serial('sub find - single with wildcard', async (t) => {
  // simple nested - single query
  await start(t)
  const client = t.context.dbClient
  await client.set({
    $id: 'ma1',
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {
      obj: {
        a: 'abba',
        b: 'babba',
        nestedRecord: {
          hello: {
            a: 'abba',
            b: 'babba',
          },
          yellow: {
            a: 'abba2',
            b: 'babba2',
          },
        },
      },
    },
  })

  let cnt = 0
  observe(
    t,
    {
      $id: 'ma1',
      id: true,
      name: true,
      record: {
        '*': {
          a: true,
          b: true,
        },
      },
    },
    (v) => {
      if (cnt === 0) {
        t.deepEqualIgnoreOrder(v, {
          id: 'ma1',
          name: 'match 1',
          record: {
            obj: { a: 'abba', b: 'babba' },
          },
        })
      } else if (cnt === 1) {
        t.deepEqualIgnoreOrder(v, {
          id: 'ma1',
          name: 'match 1',
          record: {
            obj: { a: 'abba', b: 'babba' },
            newObj: { a: 'new yes' },
          },
        })
      } else {
        t.fail()
      }

      cnt++
    }
  )

  await wait(1e3)

  t.deepEqual(cnt, 1)

  await client.set({
    $id: 'ma1',
    record: {
      newObj: {
        a: 'new yes',
      },
    },
  })

  await wait(1e3)

  t.deepEqual(cnt, 2)
})
