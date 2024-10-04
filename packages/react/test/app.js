import { Provider, useQuery, Head } from '../dist/index.js'
import React from 'react'
import based from '@based/client'
import { hydrateRoot } from 'react-dom/client'

const client = based({
  url: 'ws://localhost:8081',
})

const isNode = typeof window === 'undefined'

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

const c = React.createElement

const Title = () => {
  const { data } = useQuery('counter', { speed: 100 })

  return c('title', { children: 'POWER TITLE ' + data?.cnt })
}

const Bla = () => {
  return c('div', {
    children: [
      c(Head, {
        key: 1,
        children: c(Title),
      }),
      c('div', { children: 'derp', key: 'd' }),
    ],
  })
}

export const MyApp = () => {
  return c(Provider, {
    key: 'mep',
    client,
    children: c(Bla, { key: 'flap' }),
  })
}

if (!isNode) {
  hydrateRoot(document.getElementById('root'), React.createElement(MyApp))
}
