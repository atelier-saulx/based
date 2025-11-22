import { writeUint16, writeUint32 } from '@based/utils'

export type TypeId = number

export const OpType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCountType: 5,
  saveBlock: 67,
  saveCommon: 69,
  modify: 10,
  loadBlock: 22,
  unloadBlock: 33,
  loadCommon: 44,
} as const

/**
  id, 
  ids, 
  default,
  alias,
  aggregates,
  aggregatesCountType,
  saveBlock,
  saveCommon,
  modify,
  loadBlock,
  unloadBlock,
  loadCommon
 */
export type OpTypeEnum = (typeof OpType)[keyof typeof OpType]

export const RefOp = {
  overwrite: 0,
  add: 1,
  delete: 2,
  putOverwrite: 3,
  putAdd: 4,
} as const

// this needs number because it has a any (_) condition
export type RefOpEnum = number

/**
  equal,
  has
 */
export type FilterOpEnum = 1 | 2 // etc

export const FilterOp = {
  equal: 1,
  has: 2,
  // etc,
  isNumerical: (op: FilterOpEnum) => {
    // return true | false
  },
} as const

const MAIN_PROP = 0
const ID_PROP = 255

export const QuerySubType = {
  default: 0,
  filter: 1,
  // etc
} as const

/**
  default, 
  filter
 */
export type QuerySubTypeEnum = (typeof OpType)[keyof typeof OpType]

type QueryDefaultHeader = {
  typeId: TypeId
  offset: number
  limit: number
  sortSize: number
  filterSize: number
  searchSize: number
  subType: QuerySubTypeEnum
}

export const QueryDefaultHeaderByteSize = 17

export const writeQueryDefaultHeader = (
  buf: Uint8Array,
  header: QueryDefaultHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint32(buf, header.offset, offset)
  offset += 4
  writeUint32(buf, header.limit, offset)
  offset += 4
  writeUint16(buf, header.sortSize, offset)
  offset += 2
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  writeUint16(buf, header.searchSize, offset)
  offset += 2
  buf[offset] = header.subType
  offset += 1
  return offset
}
