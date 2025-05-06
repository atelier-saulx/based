import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('nested functions internal only', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        helloInternal: {
          type: 'function',
          internalOnly: true,
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return 'internal'
          },
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, ctx) => {
            return based.call('helloInternal', payload, ctx)
          },
        },
      },
    },
  })
  await server.start()

  await client.connect({
    url: t.context.ws,
  })
  t.is(await client.call('hello'), 'internal')
  await t.throwsAsync(client.call('snuix'))
  await t.throwsAsync(client.call('helloInternal'))
  const r = await fetch(t.context.http + '/helloInternal')
  t.is(r.status, 404)
  client.destroy()
  await server.destroy()
})

test('nested functions fn does not exist error', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, ctx) => {
            return based.call('blabla', payload, ctx)
          },
        },
      },
    },
  })
  await server.start()

  await client.connect({
    url: t.context.ws,
  })
  const err = await t.throwsAsync(client.call('hello'))
  // @ts-ignore
  t.is(err.code, 50001)
  await server.destroy()
})

test('nested query functions fn does not exist error', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, _, update) => {
            return based.query('blabla').subscribe(update)
          },
        },
      },
    },
  })
  await server.start()

  await client.connect({
    url: t.context.ws,
  })

  const errors: any[] = []
  let r = 0

  client.query('hello').subscribe(
    () => {
      r++
    },
    (err) => {
      errors.push(err)
    },
  )

  await wait(500)

  t.is(r, 0)
  t.is(errors.length, 1)
  t.is(errors[0].code, 40401)

  client.destroy()
  await server.destroy()
})
