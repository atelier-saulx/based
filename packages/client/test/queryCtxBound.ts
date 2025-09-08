import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query ctx bound', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          ctx: ['authState.userId', 'geo.country'],
          // if ctx pass it to the thign use the ctx as extra check if incoming (not only id)
          // on ctx change send invalidate cache command to client
          // if this is there pass ctx as 4th argument (different ctx)
          // add it to the payload?
          // based.query('x', {}, ctx)
          // 4th

          uninstallAfterIdleTime: 1e3,
          // 4rd argument ctx?
          fn: (based, payload, update, ctx) => {
            let cnt = 0
            update(cnt)
            console.log('SNURF!') //

            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
          },
        },
      },
    },
  })
  await server.start()

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.log('DERPY?')
    })

  await wait(500)

  close()
  t.true(true)
})
