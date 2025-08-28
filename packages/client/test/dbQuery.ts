import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { BasedDb } from '@based/db'
import { BasedClient as BasedClientOld } from '@based/client-old'
import getPort from 'get-port'

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

  const res = await client.call('getUser')
  const resQuery = await new Promise((resolve) => {
    client.query('users').subscribe((res) => resolve(res))
  })

  const resOld = await clientOld.call('getUser')
  const resQueryOld = await new Promise((resolve) => {
    clientOld.query('users').subscribe((res) => resolve(res))
    db.create('user', {
      name: 'xx',
    })
  })

  t.true(typeof resQuery === 'object')
  t.true(typeof res === 'object')
  t.deepEqual(res, resOld)
  t.deepEqual(resQuery, resQueryOld)
  console.log({ res, resOld, resQuery, resQueryOld })
})
