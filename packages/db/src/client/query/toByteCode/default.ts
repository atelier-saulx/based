import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { DEFAULT } from './offsets.js'
import { getQuerySubType } from './subType.js'
import { ID } from '@based/schema/prop-types'

// pub const QueryDefaultHeader = packed struct {
//     typeId: db.TypeId,
//     offset: u32,
//     limit: u32,
//     sortSize: u16,
//     filterSize: u16,
//     searchSize: u16,
//     subType: QuerySubType,
// };

// s[0] == @intFromEnum(ReadOp.ID)

// pub const SortHeader = packed struct {
//     order: SortOder,
//     prop: u8, // use prop type for this
//     propType: PropType,
//     start: u16,
//     len: u16,
//     lang: LangCode,
// };

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  sortSize: number,
  searchSize: number,
  sort: Uint8Array,
  search: Uint8Array,
): IntermediateByteCode => {
  const idDescSort = sortSize > 0 ? sort[1] === ID : false
  if (idDescSort) {
    sortSize = 0
  }

  const buffer = new Uint8Array(
    DEFAULT.baseSize + filterSize + sortSize + searchSize,
  )
  let index = 0
  buffer[index++] = QueryType.default
  writeUint16(buffer, def.schema.id, index)
  index += 2
  writeUint32(buffer, def.range.offset, index)
  index += 4
  writeUint32(buffer, def.range.limit, index)
  index += 4
  writeUint16(buffer, sortSize, index)
  index += 2
  writeUint16(buffer, filterSize, index)
  index += 2
  writeUint16(buffer, searchSize, index)
  index += 2

  buffer[index] = getQuerySubType(
    filterSize,
    sortSize,
    searchSize,
    sortSize > 0 && sort[0] == 1,
    idDescSort,
    searchSize > 0 && search[0] === 1,
  )
  index += 1

  if (sortSize) {
    buffer.set(sort, index)
    index += sortSize
  }

  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, index), index)
    index += filterSize
  }

  if (searchSize) {
    buffer.set(search, index)
    // last so dont need to increase index
  }

  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
