import test, { ExecutionContext } from 'ava'
// make this methods on the server
import { wait } from '@based/utils'
import getPort from 'get-port'
import { BasedClient } from '../../src/client/index.js'
import { BasedServer } from '../../src/server/server.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const testShared = async (
  t: T,
  coreClient: BasedClient,
  server: BasedServer,
) => {
  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const x = await coreClient.call('fnWithNested', { bla: true })

  t.deepEqual(x, { bla: true })

  let cnt = 0

  const closeX = coreClient.query('counter').subscribe(() => {
    cnt++
  })

  await wait(500)

  t.true(cnt > 0)

  closeX()

  let incomingCntNoJson = 0

  const close = coreClient.query('obsWithNested').subscribe(() => {
    incomingCntNoJson++
  })

  let incomingCnt = 0
  const close2 = coreClient.query('obsWithNested', 'json').subscribe(() => {
    incomingCnt++
  })

  await wait(1e3)

  const bla = await coreClient.query('obsWithNested', 'json').get()

  t.is(bla.bla.length, 1e4)

  await wait(1e3)

  let incomingCnt2 = 0
  close()
  close2()

  const close3 = coreClient
    .query('obsWithNestedLvl2', 'glurk')
    .subscribe(() => {
      incomingCnt2++
    })

  const bla2 = await coreClient.query('obsWithNestedLvl2', 'glakkel').get()

  t.is(bla2.bla.length, 1e4)

  await wait(1e3)

  close3()

  t.true(incomingCnt > 10)
  t.true(incomingCntNoJson > 0)
  t.true(incomingCnt2 > 10)

  await wait(4e3)

  t.is(server.activeObservablesById.size, 0)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  coreClient.disconnect()
  await server.destroy()
}

test.serial('nested functions (raw api)', async (t: T) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        obsWithNestedLvl2: {
          type: 'query',
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          fn: (based, _, update) => {
            return based.query('obsWithNested', 'json').subscribe(update)
          },
        },
        obsWithNested: {
          type: 'query',
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update) => {
            return based
              .query(payload === 'json' ? 'objectCounter' : 'counter', payload)
              .subscribe(update)
          },
        },
        objectCounter: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: async (_, __, update) => {
            const largeThing: { bla: any[] } = { bla: [] }
            for (let i = 0; i < 1e4; i++) {
              largeThing.bla.push({
                title: 'snurp',
                cnt: i,
                snurp: ~~(Math.random() * 19999),
              })
            }
            update(largeThing)
            const counter = setInterval(() => {
              largeThing.bla[
                ~~(Math.random() * largeThing.bla.length - 1)
              ].snup = ~~(Math.random() * 19999)
              update(largeThing)
            }, 1)
            return () => {
              clearInterval(counter)
            }
          },
        },
        counter: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: async (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
          },
        },
        fnWithNested: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, context) => {
            const x = await based.call('hello', payload, context)
            await based.query('obsWithNested', 'json', context).get()
            return x
          },
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload
            }
            return 'flap'
          },
        },
      },
    },
  })
  await server.start()

  await testShared(t, coreClient, server)
})

test.serial('nested functions (fancy api)', async (t: T) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        obsWithNestedLvl2: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: (based, _, update) => {
            return based.query('obsWithNested', 'json').subscribe(update)
          },
        },
        obsWithNested: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: async (based, payload, update) => {
            return based
              .query(payload === 'json' ? 'objectCounter' : 'counter', payload)
              .subscribe(update)
          },
        },
        objectCounter: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: async (_, __, update) => {
            const largeThing: { bla: any[] } = { bla: [] }
            for (let i = 0; i < 1e4; i++) {
              largeThing.bla.push({
                title: 'snurp',
                cnt: i,
                snurp: ~~(Math.random() * 19999),
              })
            }
            update(largeThing)
            const counter = setInterval(() => {
              largeThing.bla[
                ~~(Math.random() * largeThing.bla.length - 1)
              ].snup = ~~(Math.random() * 19999)
              update(largeThing)
            }, 1)
            return () => {
              clearInterval(counter)
            }
          },
        },
        counter: {
          closeAfterIdleTime: 1e3,
          uninstallAfterIdleTime: 1e3,
          type: 'query',
          fn: async (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
          },
        },
        fnWithNested: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, context) => {
            const x = await based.call('hello', payload, context)
            await based.query('obsWithNested', 'json').get()
            return x
          },
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            if (payload) {
              return payload
            }
            return 'flap'
          },
        },
      },
    },
  })
  await server.start()

  await testShared(t, coreClient, server)
})
