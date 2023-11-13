import { Assertions } from 'ava/lib/assert.js'
import { deepCopy } from '@saulx/utils'
import { SelvaServer } from '@based/db-server'
import { start, SubscriptionClient } from '@based/db-subs'
import { BasedDbClient } from '../../src'
import { BasedClient } from '@based/client'
import { ExecutionContext } from 'ava'
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
  subClient: SubscriptionClient
  dbClient: BasedDbClient
  pollerClient: BasedClient
  port: number
}
export const startSubs = async (
  t: ExecutionContext<TestCtx>,
  schema: BasedSchemaPartial
) => {
  const {
    dbClient,
    subscriptionClient,
    // @ts-ignore
  } = await start<TestCtx>(t)

  t.context.dbClient = dbClient
  t.context.subClient = subscriptionClient

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
