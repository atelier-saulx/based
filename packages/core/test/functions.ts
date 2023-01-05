import test from 'ava'
import { BasedCoreClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('functions', async (t) => {
  const coreClient = new BasedCoreClient()

  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: {
        maxPayloadSize: 1e8,
        function: async (payload) => {
          if (payload) {
            return payload.length
          }
          return 'flap'
        },
      },
      lotsOfData: async () => {
        let str = ''
        for (let i = 0; i < 200000; i++) {
          str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
        }
        return str
      },
    },
  })

  server.on('error', console.error)

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

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
