import React, { Component, createElement } from 'react'
import '@glideapps/glide-data-grid/dist/index.css'
import {
  DataEditor,
  DataEditorProps,
  DataEditorRef,
  DrilldownCell,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  HeaderClickedEventArgs,
  Item,
  Rectangle,
} from '@glideapps/glide-data-grid'
import { SchemaProps, SchemaPropTypes, StrictSchema } from '@based/schema'
import { BasedClient } from '@based/client'
import AutoSizer, { Size } from 'react-virtualized-auto-sizer'
import { getPropType } from '@based/schema'
import { deepEqual } from '@based/utils'

type Writeable<T> = { -readonly [P in keyof T]: T[P] }

export type TableProps = {
  client: BasedClient
  type: string
  height?: number
  width?: number
  rows?: number
  search?: {
    query: string
    fields?: string[]
  }
}

const imageReg = /(jpg|jpeg|gif|png)((\?.*)$|$)/gm
const icons: Partial<Record<SchemaPropTypes, string>> = {
  string: 'headerString',
  boolean: 'headerBoolean',
  alias: 'headerLookup',
  reference: 'headerUri',
  references: 'headerArray',
}

const getRefItem = (ref): DrilldownCell['data'][0] => {
  let text: string
  let img: string
  for (const key in ref) {
    if (ref[key] && typeof ref[key] === 'string') {
      if (imageReg.test(ref[key])) {
        img ??= ref[key]
        if (text) break
      } else {
        text ??= ref[key]
        if (img) break
      }
    }
  }
  text ??= 'Untitled'
  return { text, img }
}

const updateSchema = (
  table: _Table,
  props: TableProps,
  schema: StrictSchema,
) => {
  const typeSchema = schema.types[props.type]
  if (!typeSchema) {
    table.editor.columns = []
    table.forceUpdate()
    return
  }
  const schemaProps = schema.types[props.type].props
  table.schema = schema
  table.schemaProps = schemaProps
  const columns: GridColumn[] = Object.keys(schemaProps).map((id) => {
    const propType = getPropType(schemaProps[id])
    const { mime } = schemaProps[id]
    if (mime?.startsWith('image/')) {
      return {
        id,
        icon: 'headerImage',
        title: id,
      }
    }
    if (propType in icons) {
      return {
        id,
        icon: icons[propType],
        title: id,
      }
    }
    if (/^number$|^int|^uint/.test(propType)) {
      return {
        id,
        icon: 'headerNumber',
        title: id,
      }
    }
    return {
      id,
      title: `${id} (${propType})`,
    }
  })
  columns.unshift({
    id: 'id',
    title: 'ID',
    width: 40,
  })
  table.editor.columns = columns
  table.forceUpdate()
}

const updateTableSubs = (table: _Table, props: TableProps) => {
  if (!table.rect) {
    return
  }
  const { y, height } = table.rect
  const firstPage = ~~(y / table.limit)
  const lastPage = ~~((y + height) / table.limit)
  let i = lastPage + 1
  const subs = {}

  while (i-- > firstPage) {
    const start = i * table.limit
    const end = start + table.limit
    const query = props.client.query('derp', {
      type: props.type,
      start,
      end,
      sort: table.sort,
      search: props.search,
    })

    if (query.id in table.subs) {
      subs[query.id] = table.subs[query.id]
    } else {
      subs[query.id] = query.subscribe((res) => {
        let i = end
        const updates = []
        while (i-- > start) {
          const item = res[i - start]
          if (!item && i >= table.items.length) {
            continue
          }
          table.items[i] = item
          let j = table.editor.columns.length
          while (j--) {
            updates.push({ cell: [j, i] })
          }
        }

        if (end >= table.items.length) {
          // trim the tail
          let j = end
          while (j--) {
            if (table.items[j]) {
              break
            }
          }
          j++
          if (j === 0) {
            table.items = []
          } else if (j < table.items.length) {
            table.items.splice(j)
          }
        }

        table.editor.ref.current?.updateCells(updates)
        table.forceUpdate()
      })
    }
  }

  for (const key in table.subs) {
    if (!(key in subs)) {
      table.subs[key]()
    }
  }

  table.subs = subs
}

const updateSchemaSub = (table: _Table, props: TableProps) => {
  table.unsubSchema = props.client
    .query('schema')
    .subscribe((schema) => updateSchema(table, props, schema))
}

class _Table extends Component<TableProps> {
  update: any
  sort?: { field: string; order?: 'asc' | 'desc' }
  items: any[] = []
  schemaProps: SchemaProps = {}
  subs: Record<number, any> = {}
  schema: StrictSchema = {}
  rect: Rectangle = null
  limit = 1000
  unsubSchema: Function

  override componentDidMount(): void {
    updateSchemaSub(this, this.props)
  }

  override componentWillUnmount(): void {
    this.unsubSchema()
    for (const key in this.subs) {
      this.subs[key]()
    }
  }

  override shouldComponentUpdate(nextProps: Readonly<TableProps>): boolean {
    if (
      nextProps.type !== this.props.type ||
      nextProps.client !== this.props.client
    ) {
      updateSchemaSub(this, nextProps)
      updateTableSubs(this, nextProps)
    } else if (!deepEqual(nextProps.search, this.props.search)) {
      updateTableSubs(this, nextProps)
    }
    return true
  }

  editor: Writeable<DataEditorProps> & {
    ref: React.RefObject<DataEditorRef>
  } = {
    ref: React.createRef<DataEditorRef>(),
    columns: [],
    height: 0,
    width: 0,
    rows: 0,
    rowMarkers: 'checkbox-visible',
    allowedFillDirections: 'orthogonal',
    smoothScrollX: true,
    smoothScrollY: true,
    fillHandle: true,
    getCellContent: ([col, row]: Item): GridCell => {
      const item = this.items[row]
      if (!item) {
        return {
          kind: GridCellKind.Loading,
          allowOverlay: false,
        }
      }
      const { id } = this.editor.columns[col]
      if (id === 'id') {
        return {
          data: String(item[id]),
          kind: GridCellKind.RowID,
          allowOverlay: false,
        }
      }
      const propType = getPropType(this.schemaProps[id])
      if (propType === 'number') {
        return {
          data: item[id],
          displayData: String(item[id]),
          kind: GridCellKind.Number,
          allowOverlay: true,
        }
      }
      if (propType === 'boolean') {
        return {
          data: item[id],
          kind: GridCellKind.Boolean,
          allowOverlay: false,
        }
      }
      if (propType === 'reference') {
        const ref = item[id]
        if (ref) {
          return {
            data: [getRefItem(ref)],
            kind: GridCellKind.Drilldown,
            allowOverlay: true,
          }
        }
        return {
          data: undefined,
          displayData: '',
          kind: GridCellKind.Number,
          allowOverlay: true,
        }
      }
      if (propType === 'references') {
        const refs = item[id]
        if (refs?.length) {
          return {
            data: refs.map(getRefItem),
            kind: GridCellKind.Drilldown,
            allowOverlay: true,
          }
        }

        return {
          data: undefined,
          displayData: '',
          kind: GridCellKind.Number,
          allowOverlay: true,
        }
      }

      const { mime } = this.schemaProps[id]
      if (
        mime?.startsWith('image/') &&
        item[id] &&
        /^https:|^http:/.test(item[id])
      ) {
        return {
          data: [item[id]],
          displayData: [item[id]],
          kind: GridCellKind.Image,
          allowOverlay: true,
        }
      }
      return {
        data: item[id],
        displayData: item[id] || '',
        kind: GridCellKind.Text,
        allowOverlay: true,
      }
    },
    onHeaderClicked: (
      _colIndex: number,
      { location: [col] }: HeaderClickedEventArgs,
    ) => {
      const sort = this.editor.columns[col - 1].id
      const order =
        sort !== this.sort?.field || this.sort?.order === 'desc'
          ? 'asc'
          : 'desc'
      this.sort = { field: sort, order }
      updateTableSubs(this, this.props)
      this.forceUpdate()
    },
    onCellEdited: (cell: Item, e: EditableGridCell) => {
      const [col, row] = cell
      if (col in this.editor.columns && row in this.items) {
        const { data } = e
        const { id } = this.editor.columns[col]
        const propType = getPropType(this.schemaProps[id])
        const nodeId = this.items[row].id
        this.items[row][id] = data
        let payload = data
        if (!data || (Array.isArray(data) && data.length === 0)) {
          payload = null
        } else if (propType === 'reference') {
          payload = Number(data)
        } else if (propType === 'references') {
          payload = [Number(data)]
        }
        this.props.client.call('update', [
          this.props.type,
          nodeId,
          { [id]: payload },
        ])
      }
    },
    getCellsForSelection: true,
    onVisibleRegionChanged: (rect: Rectangle) => {
      this.rect = rect
      updateTableSubs(this, this.props)
    },
    onColumnResize: (column: GridColumn, newSize: number) => {
      // @ts-ignore
      column.width = newSize
      this.editor.columns = Array.from(this.editor.columns)
      this.forceUpdate()
    },
    onDelete: (data: GridSelection) => {
      if (data.current) {
        return true
      }
      let handled = false
      for (const i of data.rows) {
        const item = this.items[i]
        this.props.client.call('delete', [this.props.type, item.id])
        handled = true
      }
      if (handled) {
        return false
      }
      for (const i of data.columns) {
        delete this.schemaProps[this.editor.columns[i].id]
        handled = true
      }
      if (handled) {
        updateSchema(this, this.props, this.schema)
        this.props.client.call('update-schema', this.schema)
        return false
      }
      return true
    },
  }

  override render() {
    if (!this.editor.columns.length) {
      return null
    }

    this.editor.rows = this.props.rows || this.items.length
    this.editor.height = this.props.height
    this.editor.width = this.props.width

    return createElement(DataEditor, this.editor)
  }
}

export class Table extends Component<TableProps> {
  autoSizer = (size: Size) => {
    return (
      <div style={size}>
        {createElement(_Table, Object.assign(size, this.props))}
      </div>
    )
  }
  override render() {
    if (this.props.width && this.props.height) {
      return createElement(_Table, this.props)
    }
    return <AutoSizer>{this.autoSizer}</AutoSizer>
  }
}
