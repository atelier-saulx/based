import test, { ExecutionContext } from 'ava'
import getPort from 'get-port'
import { BasedServer } from '../../src/server/server.js'
import { BasedClient } from '../../src/client/index.js'
import wait from '../../src/utils/wait.js'

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
