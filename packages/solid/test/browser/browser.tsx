import { Component, createEffect } from 'solid-js'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import based, { BasedClient } from '@based/client'
import {
  BasedProvider,
  useBasedClient,
  useBasedStatus,
  useBasedQuery,
} from '@/bosons'

type FakeQueryPayloads = {
  name: string | null
  payload?: {
    count?: boolean
    data?: boolean
    speed?: number
  }
}

const client = based({
  url: 'ws://localhost:8081',
})

const queries: FakeQueryPayloads[] = [
  { name: 'counter', payload: { count: false } },
  { name: 'counter', payload: { count: true, speed: 3000 } },
  { name: 'counter', payload: { count: true, speed: 100 } },
]

const BasedContextChecker: Component = () => {
  const context: BasedClient = useBasedClient()
  const { status, connected } = useBasedStatus()

  return (
    <div>
      <div>URL: {context.opts.url.toString()}</div>
      <div>CONNECTED: {connected.toString()}</div>
      <div>STATUS: {status.toString()}</div>
    </div>
  )
}

const Tester = () => {
  const [query, setQuery] = createSignal(queries[0])
  // const [results, setResults] = createSignal([])

  createEffect(() => {
    const result = useBasedQuery(query().name, query().payload)
    console.log('Query result', result)
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
        }}
      >
        {queries.map((query) => (
          <div
            style={{
              border: '1px solid black',
              'margin-right': '10px',
              padding: '20px',
              cursor: 'pointer',
            }}
            onClick={() => setQuery(query)}
          >
            <pre>{JSON.stringify(query, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

const App: Component = () => {
  return (
    <div>
      <BasedProvider client={client}>
        <BasedContextChecker />
        <Tester />
      </BasedProvider>
    </div>
  )
}

const root = document.getElementById('app')
render(() => <App />, root!)
