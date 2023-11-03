import { Assertions } from 'ava/lib/assert.js'
import { deepCopy } from '@saulx/utils'
import { SelvaServer, startOrigin } from '@based/db-server'
import {
  SubsClient,
  createPollerSettings,
  createServerSettings,
} from '@based/db-subs'
import { BasedDbClient } from '../../src'
import { BasedClient } from '@based/client'
import { ExecutionContext, TestInterface } from 'ava'
import getPort from 'get-port'
import { BasedServer } from '@based/server'
import { BasedSchemaPartial } from '@based/schema'

declare module 'ava' {
  export interface Assertions {
    deepEqualIgnoreOrder(a: any, b: any, message?: string): boolean
    connectionsAreEmpty(): Promise<void>
  }
}

const deepSort = (a: any, b: any): void => {
  if (Array.isArray(a)) {
    if (typeof a[0] === 'object') {
      const s = (a, b) => {
        if (typeof a === 'object' && typeof b === 'object') {
          if (a.id && b.id) {
            if (b.id < a.id) {
              return -1
            } else if (b.id > a.id) {
              return 1
            } else {
              return 0
            }
          }
          // eslint-disable-next-line
          for (let k in a) {
            if (b[k] < a[k]) {
              return -1
            } else if (b[k] > a[k]) {
              return 1
            } else {
              return 0
            }
          }
        } else {
          return 0
        }
      }
      // @ts-ignore
      a.sort(s)
      b.sort(s)
    } else {
      a.sort()
      b.sort()
    }
    for (let i = 0; i < a.length; i++) {
      deepSort(a[i], b[i])
    }
  } else if (typeof a === 'object') {
    for (const k in a) {
      deepSort(a[k], b[k])
    }
  }
}

Object.assign(Assertions.prototype, {
  deepEqualIgnoreOrder(actual, expected, message = '') {
    const actCopy = deepCopy(actual)
    const expCopy = deepCopy(expected)

    if (!expCopy.createdAt) {
      delete actCopy.createdAt
    }

    if (!expCopy.updatedAt) {
      delete actCopy.updatedAt
    }

    deepSort(actCopy, expCopy)
    this.deepEqual(actCopy, expCopy, message)
  },
})

export type TestCtx = {
  srv: SelvaServer
  subClient: SubsClient
  dbClient: BasedDbClient
  pollerClient: BasedClient
  port: number
}

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

export const startSubs = async (
  t: ExecutionContext<TestCtx>,
  schema: BasedSchemaPartial
) => {
  await startPoller(t)
  await startDb(t)
  await startServer(t)

  await t.context.dbClient.updateSchema(schema)
}

export const observe = async (
  t: ExecutionContext<TestCtx>,
  q: any,
  cb: (d: any) => void
) => {
  const { subClient } = t.context
  const id = subClient.subscribe('db', q, cb)
  return id
}
