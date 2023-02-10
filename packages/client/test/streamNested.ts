import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { readStream, wait } from '@saulx/utils'

test.serial('stream nested functions', async (t) => {
  const progressEvents: number[] = []
  const server = await createSimpleServer({
    port: 9910,
    functions: {
      mySnur: async (based, payload) => {
        console.info('go go go stream for sho')
        return based.stream('hello', payload)
      },
      hello: {
        idleTimeout: 1,
        maxPayloadSize: 1e9,
        stream: true,
        function: async (based, { stream, payload }) => {
          console.info('     nested stream')

          stream.on('progress', (d) => {
            progressEvents.push(d)
          })
          await readStream(stream)
          return payload
        },
      },
    },
  })
  const client = new BasedClient()
  client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const bigBod: any[] = []
  for (let i = 0; i < 10; i++) {
    bigBod.push({ flap: 'snurp', i })
  }
  const s = await client.stream('mySnur', {
    payload: { power: true },
    contents: Buffer.from(JSON.stringify(bigBod), 'base64'),
  })

  await wait(2e3)

  t.deepEqual(s, { power: true })

  t.true(progressEvents.length > 0)
  t.is(progressEvents[progressEvents.length - 1], 1)
  // cycles of 3 secs
  client.disconnect()
  await server.destroy()
})
