import { Component, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import based, { BasedClient } from '@based/client'
import {
  BasedProvider,
  useBasedClient,
  useBasedStatus,
  useBasedQuery,
  useQuery,
} from '../../src'

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
  const query = createMemo(() => useBasedQuery(name(), payload()))

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
      }}
    >
      <div
        style={{
          'margin-top': '30px',
          display: 'flex',
          'flex-direction': 'column',
        }}
      >
        <h3>Dynamic Queries</h3>
        <div
          style={{
            'margin-top': '10px',
            display: 'flex',
          }}
        >
          {queries.map((_query) => (
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
                  height: '280px',
                  'align-content': 'center',
                }}
              >
                {JSON.stringify(_query, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          'margin-top': '30px',
          display: 'flex',
          'flex-direction': 'column',
        }}
      >
        <h3>Live Result</h3>
        <pre
          style={{
            padding: '30px',
            background: 'black',
            color: 'white',
            width: '250px',
            'margin-top': '10px',
            height: '280px',
            'align-content': 'center',
          }}
        >
          {JSON.stringify(
            {
              payload: payload(),
              data: query().data(),
              error: query().error(),
              checksum: query().checksum(),
              loading: query().loading(),
            },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  )
}

const SimpleCounter = () => {
  const { data, error, checksum, loading } = useQuery('counter', {
    count: true,
  })

  return (
    <div
      style={{
        'margin-top': '30px',
        display: 'flex',
        'flex-direction': 'column',
      }}
    >
      <h3>Static Query - Live Result</h3>
      <pre
        style={{
          padding: '30px',
          'margin-top': '10px',
          'align-content': 'center',
          border: '1px solid black',
          width: '250px',
        }}
      >
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
        <h1>Based.io Solidjs Demo</h1>
        <BasedContextChecker />
        <MultipleCounter />
        <SimpleCounter />
      </BasedProvider>
    </div>
  )
}

const root = document.getElementById('app')
render(() => <App />, root!)
