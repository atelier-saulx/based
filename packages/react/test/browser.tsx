import React, { useState } from 'react'
import based from '@based/client'
import { createRoot } from 'react-dom/client'
import { Provider, useQuery, useLoading } from '../src'

const client = based({
  url: 'ws://localhost:8081',
})

const Tester = () => {
  const somethingIsLoading = useLoading()

  const [q, setP] = useState<any>({
    name: 'counter',
    payload: { bla: true },
  })

  const x = useQuery(q.name, q.payload)

  const payloads = [
    { name: 'counter', payload: { bla: false } },
    { name: 'counter', payload: { bla: true } },
    { name: 'gurt', payload: { bla: false } },
    { name: null },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            background: somethingIsLoading ? 'red' : 'blue',
          }}
        ></div>
        {payloads.map((v) => {
          return (
            <div
              style={{
                border: '1px solid green',
                padding: 5,
                cursor: 'pointer',
              }}
              onClick={() => setP(v)}
            >
              <pre>{JSON.stringify(v, null, 2)}</pre>
            </div>
          )
        })}
      </div>

      <pre>{JSON.stringify(x, null, 2)}</pre>
    </div>
  )
}

function App() {
  return (
    <div
      style={{
        padding: 100,
      }}
    >
      <Provider client={client}>
        <Tester />
      </Provider>
    </div>
  )
}

const root = createRoot(document.body)
root.render(<App />)
