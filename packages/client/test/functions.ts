import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('functions', async (t) => {
  const coreClient = new BasedClient()

  const server = new BasedServer({
    port: 9910,
    functions: {
      specs: {
        checkPayload: {
          function: async (based, payload) => {
            return payload.power
          },
          uninstallAfterIdleTime: 1e3,
        },
        hello: {
          maxPayloadSize: 1e8,
          function: async (based, payload) => {
            if (payload) {
              return JSON.stringify(payload).length
            }
            return 'flap'
          },
          uninstallAfterIdleTime: 1e3,
        },
        lotsOfData: {
          function: async () => {
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
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

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
  console.info('Send:', ~~((str.length / 1024 / 1024) * 100) / 100, 'mb')

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
