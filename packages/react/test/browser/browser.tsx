import React, { useState } from 'react'
import based from '@based/client'
import { createRoot } from 'react-dom/client'
import { Provider, useQuery, useLoading, useWindow } from '../../src/index.js'

const client = based({
  url: 'ws://localhost:8081',
})

const Tester = () => {
  const somethingIsLoading = useLoading()

  const [q, setP] = useState<any>({
    name: 'counter',
    payload: { bla: true },
  })

  // useQuery('')

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
        />
        {payloads.map((v, i) => {
          return (
            <div
              key={i}
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
    </div>
  )
}

const UseWindowTester = () => {
  const [pages, setPages] = useState([1, 2])
  const [size, setSize] = useState(4)
  const { items, loading } = useWindow(
    'fake-db',
    ({ offset, limit }) => {
      return {
        offset,
        limit,
      }
    },
    {
      path: ['things'], // where are the items in the response?
      pages, // array of page numbers - starts at 1
      size, // amount of items per page
    },
  )

  return (
    <>
      <div style={{ display: 'flex' }}>
        <pre>{JSON.stringify({ loading, items }, null, 2)}</pre>
        <div>
          {items.map((item, index) => {
            return <div key={index}>{item?.id || '-'}</div>
          })}
        </div>
      </div>
      <button
        style={{
          background: 'lightgrey',
          padding: 16,
        }}
        onClick={() => {
          setPages(
            pages.map((n) => {
              return n + 3
            }),
          )
        }}
      >
        Move ({pages.join(',')})
      </button>
      <button
        style={{
          background: 'lightgrey',
          padding: 16,
        }}
        onClick={() => {
          setSize(size + 1)
        }}
      >
        Resize ({size})
      </button>
    </>
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
        <UseWindowTester />
      </Provider>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
