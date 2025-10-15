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
        }}
      >
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
