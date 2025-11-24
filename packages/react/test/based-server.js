import { BasedServer } from '@based/server'
import { render } from '../dist/ssr.js'
import React from 'react'
import { MyApp } from './app.js'
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

const counter = (_based, payload, update) => {
  let cnt = 0
  const int = setInterval(() => {
    update({ cnt: ++cnt })
  }, payload.speed ?? 1e3)
  return () => {
    clearInterval(int)
  }
}

const fakeDb = (_based, { offset, limit }, update) => {
  let i
  let cnt = 0
  const timer = setTimeout(() => {
    const doit = () => {
      cnt++
      const things = Array.from(Array(limit)).map((_, i) => {
        return {
          id: `${i + offset} - ${cnt}`,
        }
      })
      update({ things })
    }
    i = setInterval(doit, 1e3)
    doit()
  }, 100)
  return () => {
    clearTimeout(timer)
    clearInterval(i)
  }
}

const server = new BasedServer({
  port: 8081,
  functions: {
    configs: {
      'fake-db': {
        type: 'query',
        fn: fakeDb,
      },
      app: {
        type: 'function',
        httpResponse: async (based, payload, d, send) => {
          send(d, {
            ['content-type']: 'text/html',
          })
        },
        fn: async () => {
          const { html, head } = await render(React.createElement(MyApp))
          const bundle = await build({
            entryPoints: [__dirname + '/app.js'],
            bundle: true,
            write: false,
            minify: true,
          })
          return `<head>${head}
</head>
          <body>
          <div id="root">${html}</div>
          <script>${bundle.outputFiles[0].text}</script>
          </body>`
        },
      },
      counter: {
        type: 'query',
        fn: counter,
      },
    },
  },
})

server.start()
