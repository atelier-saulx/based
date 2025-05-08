import { filterToBuffer, isSimpleMainFilter } from '../query.js'
import { QueryDef, QueryType } from '../types.js'

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  sortSize: number,
  searchSize: number,
  sort: Uint8Array,
  search: Uint8Array,
) => {
  const buf = new Uint8Array(18 + filterSize + sortSize + searchSize)
  let index = 0
  buf[index++] = QueryType.default
  buf[index++] = def.schema.idUint8[0]
  buf[index++] = def.schema.idUint8[1]
  buf[index++] = def.range.offset
  buf[index++] = def.range.offset >>> 8
  buf[index++] = def.range.offset >>> 16
  buf[index++] = def.range.offset >>> 24
  buf[index++] = def.range.limit
  buf[index++] = def.range.limit >>> 8
  buf[index++] = def.range.limit >>> 16
  buf[index++] = def.range.limit >>> 24

  buf[index++] = filterSize
  buf[index++] = filterSize >>> 8
  buf[index++] = filterSize && isSimpleMainFilter(def.filter) ? 1 : 0
  // if (filterSize && isSimpleMainFilter(def.filter)) {
  // console.log('SIMPLE FILTER!')
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), index)
    index += filterSize
  }

  buf[index++] = sortSize
  buf[index++] = sortSize >>> 8
  if (sortSize) {
    buf.set(sort, index)
    index += sortSize
  }

  buf[index++] = searchSize
  buf[index++] = searchSize >>> 8
  if (searchSize) {
    buf.set(search, index)
    index += searchSize
  }
  return buf
}
