import { Component, createEffect, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
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
    id: number
    count?: boolean
    data?: boolean
    speed?: number
  }
}

const client = based({
  url: 'ws://localhost:8081',
})

const queries: FakeQueryPayloads[] = [
  { name: 'counter', payload: { id: 0, count: true, speed: 100 } },
  { name: 'counter', payload: { id: 1, count: false } },
  { name: 'counter', payload: { id: 2, count: true, speed: 3000 } },
]

const BasedContextChecker: Component = () => {
  const context: BasedClient = useBasedClient()
  const { status, connected } = useBasedStatus()

  return (
    <div
      style={{
        'margin-top': '10px',
      }}
    >
      <p>URL: {context.opts.url.toString()}</p>
      <p>CONNECTED: {connected().toString()}</p>
      <p>STATUS: {status()}</p>
    </div>
  )
}

const MultipleCounter = () => {
  const [name, setName] = createSignal<string>(queries[0].name)
  const [payload, setPayload] = createSignal<any>(queries[0].payload)
  const [response, setResponse] = createStore<any>({
    loading: true,
    data: null,
    error: null,
    checksum: null,
  })

  createEffect(() => {
    const { data, error, checksum, loading } = useBasedQuery(name(), payload())
    setResponse({
      data: data(),
      error: error(),
      checksum: checksum(),
      loading: loading(),
    })
  }, [name, payload])

  return (
    <div>
      <div
        style={{
          'margin-top': '30px',
          display: 'flex',
          // 'flex-direction': 'column',
        }}
      >
        {queries.map((_query, _index) => (
          <div
            style={{
              'margin-right': '10px',
              cursor: 'pointer',
              border: '1px solid black',
            }}
            onClick={() => {
              setName(_query.name)
              setPayload(_query.payload)
            }}
          >
            <pre
              style={{
                padding: '30px',
                height: '140px',
              }}
            >
              {JSON.stringify(_query, null, 2)}
            </pre>
          </div>
        ))}
        <pre
          style={{
            padding: '30px',
            background: 'black',
            color: 'white',
          }}
        >
          {JSON.stringify(response, null, 2)}
        </pre>
      </div>
    </div>
  )
}

const SimpleCounter = () => {
  const { data, error, checksum, loading } = useBasedQuery('counter', {
    count: true,
  })

  return (
    <div
      style={{
        'margin-top': '30px',
        border: '1px solid',
        padding: '30px',
        width: '250px',
        height: 'auto',
      }}
    >
      <pre>
        {JSON.stringify(
          {
            data: data(),
            error: error(),
            checksum: checksum(),
            loading: loading(),
          },
          null,
          2,
        )}
      </pre>
    </div>
  )
}

const App: Component = () => {
  return (
    <div>
      <BasedProvider client={client}>
        <h1>Based.io Solid Demo</h1>
        <BasedContextChecker />
        <MultipleCounter />
        <SimpleCounter />
      </BasedProvider>
    </div>
  )
}

const root = document.getElementById('app')
render(() => <App />, root!)
