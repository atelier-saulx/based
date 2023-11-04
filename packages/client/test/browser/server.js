import { BasedServer } from '@based/server'
import based from '@based/client'
import fs from 'node:fs/promises'
import { watch } from 'node:fs'

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// tmp to test
const client = based({
  url: 'ws://localhost:9910',
})

const fn = async () => {
  await client.query('meta').get()

  return `<html>
<head>
    ${client.genCacheScript()}
</head>
<body>
    <script src="/bundle"></script> 
</body>
</html>`
}

const start = async () => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        bundle: {
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
        hello2: {
          type: 'function',
          maxPayloadSize: 1e8,
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
