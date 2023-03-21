import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('channel simple', async (t) => {
  const client = new BasedClient()
  const internal: any[] = []
  const server = await createSimpleServer({
    port: 9910,
    channels: {
      nested: (based, payload, id, update) => {
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
      bla: (based, payload, id, update) => {
        update(1)
        return based.channel('nested').subscribe((r) => {
          internal.push(r)
        })
      },
    },
  })

  client.connect({ url: 'ws://localhost:9910' })
  client.channel('bla').subscribe(() => {})
  await wait(1000)
  client.channel('bla', { x: 1 }).subscribe(() => {})
  await wait(1000)
  t.true(internal.length > 1)
  for (const r of internal) {
    t.is(r.x.length, 1e3)
  }
  client.disconnect()
  await server.destroy()
})
