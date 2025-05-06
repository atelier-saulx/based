import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query simple', async (t: T) => {
  const client = new BasedClient()
  const internal: any[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nested: {
          type: 'query',
          fn: (_, __, update) => {
            const d: { x: number[] } = { x: [] }
            for (let i = 0; i < 1e3; i++) {
              d.x.push(i)
            }
            update(d)
            const interval = setInterval(() => {
              d.x = []
              for (let i = 0; i < 1e3; i++) {
                d.x.push(~~(Math.random() * 3))
              }
              update(d)
            }, 500)
            return () => {
              clearInterval(interval)
            }
          },
        },
        bla: {
          type: 'query',
          fn: (based, _, update) => {
            update(1)
            return based.query('nested').subscribe((r) => {
              internal.push(r)
            })
          },
        },
      },
    },
  })
  await server.start()

  client.connect({ url: t.context.ws })
  client.query('bla').subscribe(() => {})
  await wait(1000)
  client.query('bla', { x: 1 }).subscribe(() => {})
  await wait(1000)
  t.true(internal.length > 1)
  for (const r of internal) {
    t.is(r.x.length, 1e3)
  }
  client.disconnect()
  await server.destroy()
})
