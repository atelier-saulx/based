import { ExecutionContext } from 'ava'
import { deepCopy } from '@saulx/utils'
import { SelvaServer, startOrigin } from '@based/db-server'
import { BasedDbClient } from '../../src/index.js'
import anyTest, { TestFn } from 'ava'
import getPort from 'get-port'
import { BasedSchemaPartial } from '@based/schema'

const deepSort = (a: any, b: any): void => {
  if (Array.isArray(a)) {
    if (typeof a[0] === 'object') {
      const s = (a: any, b: any) => {
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

export const deepEqualIgnoreOrder = (
  t: ExecutionContext,
  actual: any,
  expected: any,
  message: string = ''
) => {
  const actCopy = deepCopy(actual)
  const expCopy = deepCopy(expected)

  if (!expCopy.createdAt) {
    delete actCopy.createdAt
  }

  if (!expCopy.updatedAt) {
    delete actCopy.updatedAt
  }

  deepSort(actCopy, expCopy)
  t.deepEqual(actCopy, expCopy, message)
}

export type TestCtx = {
  srv: SelvaServer
  client: BasedDbClient
  port: number
}

export const basicTest = (schema?: BasedSchemaPartial) => {
  const test = anyTest as TestFn<TestCtx>
  test.beforeEach(async (t) => {
    t.context.port = await getPort()
    t.context.srv = await startOrigin({
      port: t.context.port,
      name: 'default',
    })
    t.context.client = new BasedDbClient()
    t.context.client.connect({
      port: t.context.port,
      host: '127.0.0.1',
    })
    if (schema) {
      await t.context.client.updateSchema(schema)
    }
  })

  test.afterEach.always(async (t) => {
    const { srv, client } = t.context
    await srv.destroy()
    client.destroy()
  })

  return test
}
