import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { BasedDb } from '@based/db'
import { BasedClient as BasedClientOld } from '@based/client-old'
import getPort from 'get-port'
import { setTimeout } from 'node:timers/promises'
import { deepEqual } from 'node:assert'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('db query', async (t: T) => {
  const db = new BasedDb({
    path: null,
  })
  const client = new BasedClient()
  const clientOld = new BasedClientOld()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        users: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            return db.query('user').subscribe(update)
          },
        },
        getUser: {
          type: 'function',
          async fn() {
            return db.query('user').get()
          },
        },
      },
    },
  })

  await db.start({ clean: true })
  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  await server.start()

  client.connect({
    url: t.context.ws,
  })
  clientOld.connect({
    url: t.context.ws,
  })

  await db.create('user', {
    name: 'xx',
  })

  let nextResolve: any
  let nextResolveOld: any

  const res = await client.call('getUser')
  const resOld = await clientOld.call('getUser')

  client.query('users').subscribe((res) => nextResolve?.(res))
  clientOld.query('users').subscribe((res) => nextResolveOld?.(res))
  const [resQuery, resQueryOld] = await Promise.all([
    new Promise((r) => (nextResolve = r)),
    new Promise((r) => (nextResolveOld = r)),
  ])

  t.true(typeof resQuery === 'object')
  t.true(typeof res === 'object')
  t.deepEqual(res, resOld)
  t.deepEqual(resQuery, resQueryOld)

  db.create('user', { name: 'yyy' })
  const [resQuery2, resQueryOld2] = await Promise.all([
    new Promise((r) => (nextResolve = r)),
    new Promise((r) => (nextResolveOld = r)),
  ])

  deepEqual(resQuery2, [
    { id: 1, name: 'xx' },
    { id: 2, name: 'yyy' },
  ])
  deepEqual(resQuery2, resQueryOld2)
})
