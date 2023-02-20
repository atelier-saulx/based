import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('query functions perf (100k query fn instances)', async (t) => {
  const client = new BasedClient()
  let initCnt = 0
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    closeAfterIdleTime: {
      query: 100,
      channel: 60e3,
    },
    rateLimit: {
      ws: 3e6,
      drain: 3e6,
      http: 3e6,
    },
    port: 9910,
    queryFunctions: {
      counter: (based, payload, update) => {
        update({ cnt: 1, payload })
        initCnt++
        return () => {}
      },
    },
  })
  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })

  let subCnt = 0

  const closers: (() => void)[] = []
  for (let i = 0; i < 1e5; i++) {
    closers.push(
      client
        .query('counter', {
          myQuery: i,
        })
        .subscribe(() => {
          subCnt++
        })
    )
  }

  await wait(2500)
  closers[0]()

  await wait(2500)
  t.is(server.activeObservablesById.size, 1e5 - 1)
  t.is(Object.keys(server.activeObservables).length, 1)
  t.is(initCnt, 1e5)
  t.is(subCnt, 1e5)

  for (const close of closers) {
    close()
  }

  await wait(5000)
  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)

  await server.destroy()
})
