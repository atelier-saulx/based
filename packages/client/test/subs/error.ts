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

// TODO: waiting for error callback
test.serial.skip('subscription validation error', async (t) => {
  await start(t)
  const client = t.context.dbClient
  let errorCnt = 0

  // client
  //   .observe({
  //     $db: {},
  //   })
  //   .subscribe(
  //     () => {},
  //     () => {
  //       // console.log('yesh')
  //       errorCnt++
  //     }
  //   )
  // client.observe({
  //   $db: {},
  // })
  // client.observe({
  //   $db: {},
  // })
  // await wait(2e3)
  // t.is(errorCnt, 1)
  // client.observe({
  //   $db: {},
  // })
  // client
  //   .observe({
  //     $db: {},
  //   })
  //   .subscribe(
  //     () => {},
  //     () => {
  //       errorCnt++
  //     }
  //   )
  // await wait(2e3)
  // t.is(errorCnt, 2)
})

// TODO: waiting for error callback
test.serial.skip(
  'subscription initialization with multiple subscribers',
  async (t) => {
    await start(t)
    const client = t.context.dbClient

    let cnt = 0
    const id = await client.set({
      type: 'match',
      title: { en: 'snurfels' },
    })
    // client
    //   .observe({
    //     $id: id,
    //     title: true,
    //   })
    //   .subscribe(
    //     (v) => {
    //       cnt++
    //     },
    //     () => {
    //       // errorCnt++
    //     }
    //   )
    // await wait(1000)
    // client
    //   .observe({
    //     $id: id,
    //     title: true,
    //   })
    //   .subscribe(
    //     (v) => {
    //       cnt++
    //     },
    //     () => {
    //       // errorCnt++
    //     }
    //   )
    // await wait(1000)
    // t.is(cnt, 2)
    // await client.set({
    //   $id: id,
    //   title: { en: 'snurfels22' },
    // })
    // await wait(1000)
    // t.is(cnt, 4)
  }
)

// TODO: waiting for error callback
test.serial.skip('subscription error on subs manager', async (t) => {
  await start(t)
  const client = t.context.dbClient
  const results = []
  // client
  //   .observe({
  //     $language: 'en',
  //     $id: 'mayuzi',
  //     yizi: {
  //       title: true,
  //       $inherit: {
  //         $item: 'club',
  //       },
  //     },
  //     title: true,
  //   })
  //   .subscribe(
  //     (v) => {
  //       results.push(v)
  //     },
  //     (err) => {
  //       console.error(err)
  //       // errorCnt++
  //     }
  //   )
  // await wait(1000)
  // t.deepEqual(results, [{ $isNull: true }], 'correct isNull on unexisting item')
})
