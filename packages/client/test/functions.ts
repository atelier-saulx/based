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

test('functions', async (t: T) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        checkPayload: {
          type: 'function',
          fn: async (_, payload) => {
            return payload.power
          },
          uninstallAfterIdleTime: 1e3,
        },
        hello: {
          type: 'function',
          maxPayloadSize: 1e8,
          fn: async (_, payload) => {
            if (payload) {
              return JSON.stringify(payload).length
            }
            return 'flap'
          },
          uninstallAfterIdleTime: 1e3,
        },
        lotsOfData: {
          type: 'function',
          fn: async () => {
            let str = ''
            for (let i = 0; i < 200000; i++) {
              str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
            }
            return str
          },
          uninstallAfterIdleTime: 1e3,
        },
      },
    },
  })
  await server.start()

  server.on('error', console.error)

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  coreClient.once('connect', (isConnected) => {})

  const power = await coreClient.call('checkPayload', {
    power: {
      msg: 'powerfull stuff',
    },
  })

  t.is(power.msg, 'powerfull stuff')

  const helloResponsesX = await Promise.all([
    coreClient.call('hello', {
      bla: true,
    }),
    coreClient.call('hello', {
      bla: true,
    }),
    coreClient.call('hello', {
      bla: true,
    }),
  ])

  t.true(helloResponsesX[0] < 20)

  t.deepEqual(helloResponsesX[0], helloResponsesX[1])
  t.deepEqual(helloResponsesX[1], helloResponsesX[2])

  let str = ''
  for (let i = 0; i < 2000000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }

  // max size is 10mb (compressed) so this is close (50mb uncompressed)
  t.log('Send:', ~~((str.length / 1024 / 1024) * 100) / 100, 'mb')

  const helloResponses = await Promise.all([
    coreClient.call('hello', {
      bla: true,
    }),
    coreClient.call('hello', {
      bla: str,
    }),
  ])

  t.true(helloResponses[0] < 20)
  t.true(helloResponses[1] > 5e6)

  const bigString = await coreClient.call('lotsOfData')

  t.true(bigString.length > 5e6)

  await wait(15e3)

  t.is(Object.keys(server.functions.specs).length, 0)
})
