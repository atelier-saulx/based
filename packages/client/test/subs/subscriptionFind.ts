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
    root: {
      fields: { yesh: { type: 'string' }, no: { type: 'string' } },
    },
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          status: { type: 'number' },
          date: { type: 'number' },
        },
      },
    },
  })
}

// TODO: sub events should de de-duplicated better (on sub manager side)
test.serial.skip('subscription find', async (t) => {
  await start(t)
  const client = t.context.dbClient

  const matches: any[] = []
  const teams: any[] = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(teams.map((t) => client.set(t)))

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  await wait(100)

  let cnt = 0
  observe(
    t,
    {
      items: {
        name: true,
        id: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: '..',
                $value: [5, 10],
              },
            ],
          },
        },
      },
    },
    (d) => {
      cnt++
    }
  )

  await wait(1000)
  t.is(cnt, 1)

  await client.set({
    $id: matches[0].$id,
    value: 8,
  })

  await wait(1000)
  t.is(cnt, 2)

  await client.set({
    $id: matches[1].$id,
    value: 8,
  })
  await wait(1000)
  t.is(cnt, 3)

  let cnt2 = 0
  observe(
    t,
    {
      $includeMeta: true,
      items: {
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
        name: true,
        id: true,
        teams: {
          id: true,
          name: true,
          $list: {
            $find: {
              $traverse: 'ancestors',
              $filter: [
                {
                  $field: 'type',
                  $operator: '=',
                  $value: 'team',
                },
              ],
            },
          },
        },
      },
    },
    (d) => {
      cnt2++
    }
  )

  await wait(1000)
  t.is(cnt2, 1)

  let matchTeam: any
  for (let i = 0; i < 10; i++) {
    matches.forEach((m) => {
      m.value = 8
      m.parents = {
        $add: [
          (matchTeam = teams[~~(Math.random() * teams.length)].$id),
          teams[~~(Math.random() * teams.length)].$id,
        ],
      }
    })
  }

  await Promise.all(matches.map((t) => client.set(t)))

  await wait(1000)
  t.is(cnt2, 2)

  let cnt3 = 0
  observe(
    t,
    {
      $id: matchTeam,
      $includeMeta: true,
      children: {
        name: true,
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: '..',
                $value: [5, 10],
              },
            ],
          },
        },
      },
    },
    (d) => {
      cnt3++
    }
  )

  await wait(1000)
  // how to handle large responses ???

  // remove unpack

  // for now 1k
  const amount = 10 // 10k wrong 5k fine

  const x: any[] = []
  for (let i = 0; i < amount; i++) {
    x.push(
      client.set({
        type: 'match',
        value: i,
        parents: { $add: matchTeam },
      })
    )
  }

  const ids = await Promise.all(x)

  await wait(2000)

  client.set({
    $id: ids[6],
    name: 'FLURRRRP',
  })
  await wait(1000)

  t.is(cnt3, 3, 'check for count')
  await wait(2000)
})
