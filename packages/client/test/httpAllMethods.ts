import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import getPort from 'get-port'
import { isHttpContext } from '@based/functions'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('http methods', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        bla: {
          type: 'function',
          fn: async (based, payload, ctx) => {
            if (isHttpContext(ctx)) {
              return 'derp-' + ctx.session.method
            }
            return 'derp'
          },
        },
      },
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  t.is(
    await (await fetch(t.context.http + '/bla', { method: 'delete' })).text(),
    'derp-delete',
  )

  t.is(
    await (await fetch(t.context.http + '/bla', { method: 'trace' })).text(),
    'derp-trace',
  )

  t.is(
    await (await fetch(t.context.http + '/bla', { method: 'post' })).text(),
    'derp-post',
  )

  t.is(
    await (await fetch(t.context.http + '/bla', { method: 'get' })).text(),
    'derp-get',
  )

  // t.is(
  //   await (await fetch(t.context.http + '/bla', { method: 'head' })).text(),
  //   'derp-head',
  // )

  await server.destroy()
})
