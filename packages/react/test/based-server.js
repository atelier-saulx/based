import { BasedServer } from '@based/server'
import { render } from '../dist/ssr.js'
import { Provider, useClient, useQuery } from '../dist/index.js'
import React from 'react'
import based from '@based/client'

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

const client = based({
  url: 'ws://localhost:8081',
})

client.on('connect', () => {
  console.log('CONNECT')
})

const Smup = ({ cnt }) => {
  const { data, loading } = useQuery('counter', {
    speed: 1000,
  })
  if (loading) {
    return 'loading...'
  }
  return `cnt fast  ${cnt} cnt  slow ${data.cnt}`
}

const Flap = () => {
  const { data, loading } = useQuery('counter', {
    speed: 100,
  })
  if (loading) {
    return 'loading...'
  }
  return React.createElement(Smup, { cnt: data.cnt })
}

const MyApp = () => {
  return React.createElement(Provider, {
    client,
    children: [React.createElement(Flap)],
  })
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
        httpResponse: (based, payload, d, send) => {
          send(d, {
            ['content-type']: 'text/html',
          })
        },
        fn: async () => {
          const { html } = await render(React.createElement(MyApp))
          return html
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
