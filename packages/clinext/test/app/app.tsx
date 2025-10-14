import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import based from '@based/client'
import '@glideapps/glide-data-grid/dist/index.css'
import {
  DataEditor,
  DataEditorRef,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  HeaderClickedEventArgs,
  Item,
  Rectangle,
} from '@glideapps/glide-data-grid'
import { SchemaProps, StrictSchema } from '@based/schema'

const incr = (cnt) => cnt + 1
const client = based()

class Store {
  constructor(type: string, setState: Function) {
    this.update = () => setState(incr)
    this.type = type
  }
  ref = React.createRef<DataEditorRef>()
  type: string
  update: any
  sort: string = ''
  order: 'asc' | 'desc' = 'asc'
  items: any[] = []
  cols: GridColumn[] = []
  props: SchemaProps = {}
  subs: Record<number, any> = {}
  schema: StrictSchema = {}
  rect: Rectangle = null
  firstPage = 0
  lastPage = 0
  limit = 1000

  onMount = () => {
    const unsubSchema = client.query('schema').subscribe(this.onSchema)
    return () => {
      unsubSchema()
      for (const key in this.subs) {
        this.subs[key]()
      }
    }
  }

  getCellContent = ([col, row]: Item): GridCell => {
    const item = this.items[row]
    if (!item) {
      return {
        kind: GridCellKind.Loading,
        allowOverlay: false,
      }
    }

    const { id } = this.cols[col]

    if (id === 'id') {
      return {
        data: String(item[id]),
        kind: GridCellKind.RowID,
        allowOverlay: false,
      }
    }

    return {
      data: item[id],
      displayData: item[id] || '',
      kind: GridCellKind.Text,
      allowOverlay: true,
    }
  }
  onHeaderClicked = (
    _colIndex: number,
    { location: [col] }: HeaderClickedEventArgs,
  ) => {
    const sort = this.cols[col - 1].id
    const order = sort !== this.sort || this.order === 'desc' ? 'asc' : 'desc'
    this.sort = sort
    this.order = order
    this.onVisibleRegionChanged(this.rect)
    this.update()
  }
  onCellEdited = (cell: Item, e: EditableGridCell) => {
    const [col, row] = cell
    if (col in this.cols && row in this.items) {
      const { data } = e
      const { id } = this.cols[col]
      const nodeId = this.items[row].id
      this.items[row][id] = data
      client.call('update', [this.type, nodeId, { [id]: data }])
    }
  }
  onVisibleRegionChanged = (rect: Rectangle) => {
    const { y, height } = rect
    const firstPage = ~~(y / this.limit)
    const lastPage = ~~((y + height) / this.limit)
    const { sort, order } = this
    let i = lastPage + 1
    const subs = {}
    while (i-- > firstPage) {
      const start = i * this.limit
      const end = start + this.limit
      const query = client.query('derp', {
        type: 'user',
        start,
        end,
        sort,
        order,
      })
      if (query.id in this.subs) {
        subs[query.id] = this.subs[query.id]
      } else {
        subs[query.id] = query.subscribe((res) => {
          let last = end
          let i = end
          const updates = []
          while (i-- > start) {
            const item = res[i - start]
            this.items[i] = item
            let j = this.cols.length
            while (j--) {
              updates.push({ cell: [j, i] })
            }
            if (!item) {
              last = i
            }
          }
          this.ref.current.updateCells(updates)
          this.update()
        })
      }
    }

    for (const key in this.subs) {
      if (!(key in subs)) {
        this.subs[key]()
      }
    }

    this.subs = subs
    this.rect = rect
    this.firstPage = firstPage
    this.lastPage = lastPage
  }
  onSchema = (schema) => {
    const props = schema.types[this.type].props
    this.schema = schema
    this.props = props
    this.cols = Object.keys(props).map((id) => {
      return { id, title: id }
    })
    this.cols.unshift({ id: 'id', title: 'ID', width: 80 })
    this.update()
  }

  onColumnResize = (column: GridColumn, newSize: number) => {
    // @ts-ignore
    column.width = newSize
    this.cols = Array.from(this.cols)
    this.update()
  }

  onDelete = (data: GridSelection) => {
    if (data.current) {
      return true
    }
    let handled = false
    for (const i of data.rows) {
      const item = this.items[i]
      client.call('delete', [this.type, item.id])
      handled = true
    }
    if (handled) {
      return false
    }
    for (const i of data.columns) {
      delete this.props[this.cols[i].id]
      handled = true
    }
    if (handled) {
      this.onSchema(this.schema)
      client.call('update-schema', this.schema)
      return false
    }
    return true
  }
}

export default function App() {
  const height = innerHeight
  const width = innerWidth
  const rowHeight = 36
  const [, setState] = useState(0)
  const type = 'user'
  const store = useRef<Store>(null)
  const {
    ref,
    cols,
    schema,
    onMount,
    onSchema,
    getCellContent,
    onHeaderClicked,
    onCellEdited,
    onVisibleRegionChanged,
    onColumnResize,
    onDelete,
  } = (store.current ??= new Store(type, setState))

  useEffect(onMount, [])

  if (!cols.length) {
    return null
  }

  return (
    <DataEditor
      rightElement={
        <button
          onClick={() => {
            schema.types[type].props[
              'rando' + Math.random().toString(36).replace('.', '-')
            ] = {
              type: 'string',
            }
            client.call('update-schema', schema)
            onSchema(schema)
          }}
        >
          add field
        </button>
      }
      rightElementProps={{
        sticky: true,
      }}
      ref={ref}
      height={height}
      smoothScrollX
      smoothScrollY
      width={width}
      rowHeight={rowHeight}
      columns={cols}
      rows={1e6}
      overscrollX={200}
      overscrollY={200}
      maxColumnAutoWidth={500}
      maxColumnWidth={2000}
      rowMarkers={{
        kind: 'checkbox',
        checkboxStyle: 'circle', // | "square";
      }}
      getCellContent={getCellContent}
      onHeaderClicked={onHeaderClicked}
      onCellEdited={onCellEdited}
      onVisibleRegionChanged={onVisibleRegionChanged}
      onDelete={onDelete}
      onColumnResize={onColumnResize}
    />
  )
}

createRoot(document.getElementById('root')).render(<App />)
