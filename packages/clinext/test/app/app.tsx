import React from 'react'
import { createRoot } from 'react-dom/client'
import { Table } from './components/table.js'
import based from '@based/client'
import { Provider } from '@based/react'
import { useQueryState } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { Topbar } from './components/topbar.js'
import '@picocss/pico/css/pico.classless.conditional.slate.min.css'
import { extend } from './extend.js'

const client = based()

extend(HTMLElement.prototype)

export default function App() {
  const [search, setSearch] = useQueryState('search', { defaultValue: '' })
  const [type, setType] = useQueryState('type', { defaultValue: '' })
  return (
    <div style-="flex;column;100vh">
      <Topbar
        type={type}
        search={search}
        setSearch={setSearch}
        setType={setType}
      />
      <div style-="grow;relative">
        <div className="pico" style-="absolute;flex;center;inset:0">
          <article>
            {type
              ? 'This type does not exist. Press "add row" to create it.'
              : 'Select a type to get started.'}
          </article>
        </div>
        <Table
          client={client}
          type={type}
          search={{
            query: search,
          }}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <Provider client={client}>
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  </Provider>,
)
