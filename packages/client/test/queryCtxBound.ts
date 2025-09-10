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
    // silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          ctx: ['authState.token', 'geo.country'],
          // if ctx pass it to the thign use the ctx as extra check if incoming (not only id)
          // on ctx change send invalidate cache command to client
          // if this is there pass ctx as 4th argument (different ctx)
          // add it to the payload?
          // based.query('x', {}, ctx)
          // 4th

          uninstallAfterIdleTime: 1e3,
          // 4rd argument ctx?
          fn: (based, payload, update, error, ctx) => {
            let cnt = 0
            update(cnt)
            console.log('SNURF -> CTX:', ctx) //

            const counter = setInterval(() => {
              console.log('snurp?')
              update(++cnt)
            }, 100)
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

  // const close2 = client
  //   .query('counter', {
  //     myQuery: 123,
  //   })
  //   .subscribe((d) => {
  //     console.log('DERPY?')
  //   })

  await wait(500)

  const result = await client.setAuthState({ token: '?' })

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.log('DERPY? update', d)
    })

  await wait(300)

  console.log('--> CLOSE')
  close()
  // close2()
  t.true(true)
})
