import { BasedServer } from '@based/server'
import { createCacheScriptTag } from '@based/client/ssr'

import based from '@based/client'
import fs from 'node:fs/promises'
import { watch } from 'node:fs'

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

// tmp to test
const client = based({
  url: 'http://localhost:9910',
})

client.setAuthState({
  token: 'mock_token',
})

const fn = async () => {
  await client.query('meta').get()

  return `<html>
<head>
    ${createCacheScriptTag(client)}
</head>
<body>
    <script src="/bundle"></script> 
</body>
</html>`
}

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
        bundle: {
          public: true,
          type: 'function',
          fn: async () => {
            return fs.readFile(join(__dirname, './out.js'), 'utf-8')
          },
          httpResponse: async (_, __, data, send) => {
            send(data, {
              'content-type': 'text/javascript',
            })
          },
        },
        text: {
          type: 'query',
          fn: (based, payload, update) => {
            const arr = []
            for (let i = 0; i < 1e3; i++) {
              arr.push('hello!  ' + i)
            }
            update(arr)
            return () => {}
          },
        },
        meta: {
          type: 'query',
          closeAfterIdleTime: 60e3,
          fn: async (based, payload, update) => {
            const path = join(__dirname, './meta.json')
            update(JSON.parse(await fs.readFile(path, 'utf-8')))
            const watcher = watch(path)
            watcher.on('change', async () => {
              update(JSON.parse(await fs.readFile(path, 'utf-8')))
            })
            return () => {
              watcher.close()
            }
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
        hello2: {
          type: 'function',
          maxPayloadSize: 1e8,
          public: true,
          path: '/',
          fn,
          httpResponse: async (_, __, data, send) => {
            send(data, {
              'content-type': 'text/html',
            })
          },
        },
      },
    },
  })
  await server.start()
}

start()
