import React, { useState } from 'react'
import based, { BasedClient } from '@based/client'
import { createRoot } from 'react-dom/client'
import {
  BasedProvider,
  useBasedClient,
  useBasedStatus,
  useBasedQuery,
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

const BasedContextChecker = () => {
  const context: BasedClient = useBasedClient()
  const { status, connected } = useBasedStatus()

  return (
    <div
      style={{
        marginTop: '10px',
      }}
    >
      <p>URL: {context.opts.url.toString()}</p>
      <p>CONNECTED: {connected.toString()}</p>
      <p>STATUS: {status}</p>
    </div>
  )
}

const MultipleCounter = () => {
  const [name, setName] = useState<string>(queries[0].name)
  const [payload, setPayload] = useState<any>(queries[0].payload)
  const { data, loading, error, checksum } = useBasedQuery(name, payload)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      <div
        style={{
          marginTop: '30px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3>Dynamic Queries</h3>
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
          }}
        >
          {queries.map((_query, index) => (
            <div
              key={index}
              style={{
                marginRight: '10px',
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
                  alignContent: 'center',
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
          marginTop: '30px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3>Live Result</h3>
        <pre
          style={{
            padding: '30px',
            background: 'black',
            color: 'white',
            width: '250px',
            marginTop: '10px',
            height: '280px',
            alignContent: 'center',
          }}
        >
          {JSON.stringify(
            {
              payload,
              data,
              error,
              checksum,
              loading,
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
  const { data, error, checksum, loading } = useBasedQuery('counter', {
    count: true,
  })

  return (
    <div
      style={{
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3>Static Query - Live Result</h3>
      <pre
        style={{
          padding: '30px',
          marginTop: '10px',
          alignContent: 'center',
          border: '1px solid black',
          width: '250px',
        }}
      >
        {JSON.stringify(
          {
            data,
            error,
            checksum,
            loading,
          },
          null,
          2,
        )}
      </pre>
    </div>
  )
}

function App() {
  return (
    <div>
      <BasedProvider client={client}>
        <h1>Based.io React Demo</h1>
        <BasedContextChecker />
        <MultipleCounter />
        <SimpleCounter />
      </BasedProvider>
    </div>
  )
}

const root = createRoot(document.getElementById('app'))
root.render(<App />)
