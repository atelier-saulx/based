import { useClient, useQuery } from '@based/react'
import { StrictSchema } from '@based/schema'
import React, { useEffect, useState } from 'react'
import { useLayer } from 'react-laag'

const RowButton = ({ type }) => {
  const client = useClient()
  return (
    <button
      style-="flex-shrink:0;height: 60px"
      onClick={() => client.call('create', [type])}
    >
      add row
    </button>
  )
}

const SearchInput = ({ search, setSearch }) => {
  return (
    <input
      type="search"
      placeholder="Search..."
      value={search}
      onChange={(e) => {
        setSearch(e.target.value)
      }}
    />
  )
}

const ColButton = ({ type }) => {
  const client = useClient()
  return (
    <button
      style={{ flexShrink: 0, height: 60 }}
      onClick={async () => {
        const name = prompt('column name?')
        if (!name) return
        const propType = prompt('prop type?')
        if (!propType) return
        const mime = propType === 'string' && prompt('mime?')
        const schema: StrictSchema = await client.query('schema').get()
        if (propType === 'reference') {
          schema.types[type].props[name] = { ref: type, prop: name }
        } else if (propType === 'references') {
          schema.types[type].props[name] = {
            items: { ref: type, prop: name },
          }
        } else {
          schema.types[type].props[name] = {
            type: propType,
            mime: mime || undefined,
          }
        }

        client.call('update-schema', schema)
      }}
    >
      add col
    </button>
  )
}

const TypeInput = ({ type, setType }) => {
  const { data } = useQuery('schema')
  const [items, setItems] = useState([])
  const [focus, setFocus] = useState(false)
  const isOpen = items.length && focus
  const { renderLayer, triggerProps, layerProps } = useLayer({
    isOpen,
    placement: 'bottom-start',
  })

  useEffect(() => {
    const types = Object.keys(data?.types || {})
    const low = type.toLowerCase()
    setItems(
      types.filter((v) => {
        const lowV = v.toLowerCase()
        return lowV !== low && lowV.includes(low)
      }),
    )
  }, [type])

  return (
    <>
      <input
        {...triggerProps}
        type="search"
        placeholder="Enter type..."
        value={type}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => setType(e.target.value)}
      />
      {isOpen
        ? renderLayer(
            <div
              {...layerProps}
              style={{
                ...layerProps.style,
                display: 'flex',
                gap: 8,
                padding: 8,
              }}
            >
              {items.map((item) => (
                <button key={item} onMouseDown={() => setType(item)}>
                  {item}
                </button>
              ))}
            </div>,
          )
        : null}
    </>
  )
}

export const Topbar = ({ type, search, setSearch, setType }) => {
  return (
    <div className="pico">
      <nav className="pico" style-="gap:8px;padding:8px;height:80px">
        <TypeInput type={type} setType={setType} />
        <SearchInput search={search} setSearch={setSearch} />
        <ColButton type={type} />
        <RowButton type={type} />
      </nav>
    </div>
  )
}
