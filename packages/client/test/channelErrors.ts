import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('Channel does not exist', async (t: T) => {
  const server = new BasedServer({ port: t.context.port })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  let errCnt = 0
  client.channel('bla').subscribe(
    () => {},
    () => {
      errCnt++
    },
  )
  await wait(500)
  t.is(errCnt, 1)
  client.disconnect()
  await server.destroy()
})
