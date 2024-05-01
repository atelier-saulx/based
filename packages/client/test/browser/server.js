import { BasedServer } from '@based/server'
import based from '@based/client'

// tmp to test
const client = based({
  url: 'http://localhost:9910',
})

client.setAuthState({
  token: 'mock_token',
})

const start = async () => {
  const server = new BasedServer({
    port: 9910,
    auth: {
      // TODO: make this the default...
      verifyAuthState: async (_, ctx, authState) => {
        if (authState.token !== ctx.session?.authState.token) {
          return { ...authState }
        }
        return true
      },
      authorize: async (_, ctx) => {
        return ctx.session?.authState.token === 'mock_token'
      },
    },
    functions: {
      configs: {
        flap: {
          public: true,
          maxPayloadSize: 1e9,
          type: 'stream',
          fn: async (based, { stream, size }, ctx) => {
            console.log('incoming', size / 1e6, 'mb', { stream })
            stream.on('progress', console.info)
            let data = 'yesh!'
            for await (const chunk of stream) {
              console.log('CHUNK!')
              if (size < 1e6) {
                data += chunk
              }
            }
            return {
              power: 1000,
              data,
            }
          },
        },
        text: {
          public: true,
          type: 'query',
          fn: (based, payload, update) => {
            const arr = []
            for (let i = 0; i < 10; i++) {
              arr.push('hello!  ' + i)
            }
            update(arr)
            return () => {}
          },
        },
        login: {
          type: 'function',
          public: true,
          fn: async (based, payload, ctx) => {
            if (payload.name === 'x' && payload.password === 'x') {
              based.renewAuthState(ctx, {
                token: 'mock_token',
                persistent: true,
              })
            }
          },
        },
        hello: {
          type: 'function',
          public: true,
          fn: async (based, payload, ctx) => {
            return 'world'
          },
        },
        helloSecure: {
          type: 'function',
          fn: async (based, payload, ctx) => {
            return 'world'
          },
        },
        counter: {
          type: 'query',
          closeAfterIdleTime: 60e3,
          fn: async (based, payload, update) => {
            let cnt = 0
            update(cnt)
            const interval = setInterval(() => {
              update(++cnt)
            }, 100)
            return () => {
              clearInterval(interval)
            }
          },
        },
      },
    },
  })
  await server.start()
}

start()
