import React from 'react'
import { createRoot } from 'react-dom/client'
import { Table } from './components/table.js'
import based from '@based/client'
import { Provider } from '@based/react'
import { useQueryState } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { Topbar } from './components/topbar.js'
import '@picocss/pico/css/pico.classless.conditional.slate.min.css'

const client = based()
export default function App() {
  const [search, setSearch] = useQueryState('search', { defaultValue: '' })
  const [type, setType] = useQueryState('type', { defaultValue: '' })
  return (
    <>
      <Topbar
        type={type}
        search={search}
        setSearch={setSearch}
        setType={setType}
      />
      <div
        style={{
          height: 'calc(100vh - 96px)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div
          className="pico"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {type ? (
            <article>
              This type does not exist. Press "add row" to create it.
            </article>
          ) : (
            <article>Select a type to get started.</article>
          )}
        </div>
        <Table
          client={client}
          type={type}
          search={{
            query: search,
          }}
        />
      </div>
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <Provider client={client}>
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  </Provider>,
)
