import { 
  writeUint16, writeInt16, 
  writeUint32, writeInt32, 
  writeUint64, writeInt64, 
  writeFloatLE, writeDoubleLE,
  readUint16, readInt16, 
  readUint32, readInt32, 
  readUint64, readInt64, 
  readFloatLE, readDoubleLE
} from '@based/utils'

export type TypeId = number

export const OpType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCountType: 5,
  blockHash: 42,
  saveBlock: 67,
  saveCommon: 69,
  modify: 127,
  loadBlock: 128,
  unloadBlock: 129,
  loadCommon: 130,
  createType: 131,
} as const

export const OpTypeInverse = {
  0: 'id',
  1: 'ids',
  2: 'default',
  3: 'alias',
  4: 'aggregates',
  5: 'aggregatesCountType',
  42: 'blockHash',
  67: 'saveBlock',
  69: 'saveCommon',
  127: 'modify',
  128: 'loadBlock',
  129: 'unloadBlock',
  130: 'loadCommon',
  131: 'createType',
} as const

/**
  id, 
  ids, 
  default, 
  alias, 
  aggregates, 
  aggregatesCountType, 
  blockHash, 
  saveBlock, 
  saveCommon, 
  modify, 
  loadBlock, 
  unloadBlock, 
  loadCommon, 
  createType 
 */
export type OpTypeEnum = (typeof OpType)[keyof typeof OpType]

export const ModOp = {
  switchProp: 0,
  switchIdUpdate: 1,
  switchType: 2,
  createProp: 3,
  deleteSortIndex: 4,
  updatePartial: 5,
  updateProp: 6,
  addEmptySort: 7,
  switchIdCreateUnsafe: 8,
  switchIdCreate: 9,
  switchIdCreateRing: 19,
  switchEdgeId: 20,
  deleteNode: 10,
  delete: 11,
  increment: 12,
  decrement: 13,
  expire: 14,
  addEmptySortText: 15,
  deleteTextField: 16,
  upsert: 17,
  insert: 18,
  padding: 255,
} as const

export const ModOpInverse = {
  0: 'switchProp',
  1: 'switchIdUpdate',
  2: 'switchType',
  3: 'createProp',
  4: 'deleteSortIndex',
  5: 'updatePartial',
  6: 'updateProp',
  7: 'addEmptySort',
  8: 'switchIdCreateUnsafe',
  9: 'switchIdCreate',
  19: 'switchIdCreateRing',
  20: 'switchEdgeId',
  10: 'deleteNode',
  11: 'delete',
  12: 'increment',
  13: 'decrement',
  14: 'expire',
  15: 'addEmptySortText',
  16: 'deleteTextField',
  17: 'upsert',
  18: 'insert',
  255: 'padding',
} as const

/**
  switchProp, 
  switchIdUpdate, 
  switchType, 
  createProp, 
  deleteSortIndex, 
  updatePartial, 
  updateProp, 
  addEmptySort, 
  switchIdCreateUnsafe, 
  switchIdCreate, 
  switchIdCreateRing, 
  switchEdgeId, 
  deleteNode, 
  delete, 
  increment, 
  decrement, 
  expire, 
  addEmptySortText, 
  deleteTextField, 
  upsert, 
  insert, 
  padding 
 */
export type ModOpEnum = (typeof ModOp)[keyof typeof ModOp]

export const PropType = {
  null: 0,
  timestamp: 1,
  created: 2,
  updated: 3,
  number: 4,
  cardinality: 5,
  uint8: 6,
  uint32: 7,
  boolean: 9,
  enum: 10,
  string: 11,
  text: 12,
  reference: 13,
  references: 14,
  microBuffer: 17,
  alias: 18,
  aliases: 19,
  int8: 20,
  int16: 21,
  uint16: 22,
  int32: 23,
  binary: 25,
  vector: 27,
  json: 28,
  colVec: 30,
  object: 29,
  id: 255,
} as const

export const PropTypeInverse = {
  0: 'null',
  1: 'timestamp',
  2: 'created',
  3: 'updated',
  4: 'number',
  5: 'cardinality',
  6: 'uint8',
  7: 'uint32',
  9: 'boolean',
  10: 'enum',
  11: 'string',
  12: 'text',
  13: 'reference',
  14: 'references',
  17: 'microBuffer',
  18: 'alias',
  19: 'aliases',
  20: 'int8',
  21: 'int16',
  22: 'uint16',
  23: 'int32',
  25: 'binary',
  27: 'vector',
  28: 'json',
  30: 'colVec',
  29: 'object',
  255: 'id',
} as const

/**
  null, 
  timestamp, 
  created, 
  updated, 
  number, 
  cardinality, 
  uint8, 
  uint32, 
  boolean, 
  enum, 
  string, 
  text, 
  reference, 
  references, 
  microBuffer, 
  alias, 
  aliases, 
  int8, 
  int16, 
  uint16, 
  int32, 
  binary, 
  vector, 
  json, 
  colVec, 
  object, 
  id 
 */
export type PropTypeEnum = (typeof PropType)[keyof typeof PropType]

export const RefOp = {
  overwrite: 0,
  add: 1,
  delete: 2,
  putOverwrite: 3,
  putAdd: 4,
} as const

export const RefOpInverse = {
  0: 'overwrite',
  1: 'add',
  2: 'delete',
  3: 'putOverwrite',
  4: 'putAdd',
} as const

/**
  overwrite, 
  add, 
  delete, 
  putOverwrite, 
  putAdd 
 */
// this needs number because it has a any (_) condition
export type RefOpEnum = 0 | 1 | 2 | 3 | 4 | (number & {})

export const ReadOp = {
  none: 0,
  id: 255,
  edge: 252,
  references: 253,
  reference: 254,
  aggregation: 250,
  meta: 249,
} as const

export const ReadOpInverse = {
  0: 'none',
  255: 'id',
  252: 'edge',
  253: 'references',
  254: 'reference',
  250: 'aggregation',
  249: 'meta',
} as const

/**
  none, 
  id, 
  edge, 
  references, 
  reference, 
  aggregation, 
  meta 
 */
export type ReadOpEnum = (typeof ReadOp)[keyof typeof ReadOp]

export const ReferencesSelect = {
  index: 1,
  any: 2,
  all: 3,
} as const

export const ReferencesSelectInverse = {
  1: 'index',
  2: 'any',
  3: 'all',
} as const

/**
  index, 
  any, 
  all 
 */
export type ReferencesSelectEnum = (typeof ReferencesSelect)[keyof typeof ReferencesSelect]

export const RefEdgeOp = {
  noEdgeNoIndexRealId: 0,
  edgeNoIndexRealId: 1,
  edgeIndexRealId: 2,
  noEdgeIndexRealId: 3,
  noEdgeNoIndexTmpId: 4,
  edgeNoIndexTmpId: 5,
  edgeIndexTmpId: 6,
  noEdgeIndexTmpId: 7,
} as const

export const RefEdgeOpInverse = {
  0: 'noEdgeNoIndexRealId',
  1: 'edgeNoIndexRealId',
  2: 'edgeIndexRealId',
  3: 'noEdgeIndexRealId',
  4: 'noEdgeNoIndexTmpId',
  5: 'edgeNoIndexTmpId',
  6: 'edgeIndexTmpId',
  7: 'noEdgeIndexTmpId',
} as const

/**
  noEdgeNoIndexRealId, 
  edgeNoIndexRealId, 
  edgeIndexRealId, 
  noEdgeIndexRealId, 
  noEdgeNoIndexTmpId, 
  edgeNoIndexTmpId, 
  edgeIndexTmpId, 
  noEdgeIndexTmpId 
 */
// this needs number because it has a any (_) condition
export type RefEdgeOpEnum = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | (number & {})

export const LangCode = {
  NONE: 0,
} as const

export const LangCodeInverse = {
  0: 'NONE',
} as const

/**
  NONE 
 */
// this needs number because it has a any (_) condition
export type LangCodeEnum = 0 | (number & {})

export const MAIN_PROP = 0
export const ID_PROP = 255

export const IncludeOp = {
  default: 1,
  referencesAggregation: 2,
  edge: 3,
  references: 4,
  reference: 5,
  meta: 6,
  partial: 7,
} as const

export const IncludeOpInverse = {
  1: 'default',
  2: 'referencesAggregation',
  3: 'edge',
  4: 'references',
  5: 'reference',
  6: 'meta',
  7: 'partial',
} as const

/**
  default, 
  referencesAggregation, 
  edge, 
  references, 
  reference, 
  meta, 
  partial 
 */
export type IncludeOpEnum = (typeof IncludeOp)[keyof typeof IncludeOp]

export const ReadRefOp = {
  references: ReadOp.references,
  reference: ReadOp.reference,
  none: ReadOp.none,
} as const

export const ReadRefOpInverse = {
  [ReadOp.references]: 'references',
  [ReadOp.reference]: 'reference',
  [ReadOp.none]: 'none',
} as const

/**
  references, 
  reference, 
  none 
 */
export type ReadRefOpEnum = (typeof ReadRefOp)[keyof typeof ReadRefOp]

export const ResultType = {
  default: 0,
  references: 1,
  reference: 2,
  edge: 3,
  referencesEdge: 4,
  referenceEdge: 5,
  aggregate: 6,
  meta: 7,
  metaEdge: 8,
  fixed: 9,
  edgeFixed: 10,
} as const

export const ResultTypeInverse = {
  0: 'default',
  1: 'references',
  2: 'reference',
  3: 'edge',
  4: 'referencesEdge',
  5: 'referenceEdge',
  6: 'aggregate',
  7: 'meta',
  8: 'metaEdge',
  9: 'fixed',
  10: 'edgeFixed',
} as const

/**
  default, 
  references, 
  reference, 
  edge, 
  referencesEdge, 
  referenceEdge, 
  aggregate, 
  meta, 
  metaEdge, 
  fixed, 
  edgeFixed 
 */
export type ResultTypeEnum = (typeof ResultType)[keyof typeof ResultType]

export const AggFn = {
  none: 0,
  avg: 1,
  cardinality: 2,
  concat: 3,
  count: 4,
  max: 5,
  min: 6,
  mode: 7,
  percentile: 8,
  rank: 9,
  stddev: 10,
  sum: 11,
  variance: 12,
  harmonicMean: 13,
} as const

export const AggFnInverse = {
  0: 'none',
  1: 'avg',
  2: 'cardinality',
  3: 'concat',
  4: 'count',
  5: 'max',
  6: 'min',
  7: 'mode',
  8: 'percentile',
  9: 'rank',
  10: 'stddev',
  11: 'sum',
  12: 'variance',
  13: 'harmonicMean',
} as const

/**
  none, 
  avg, 
  cardinality, 
  concat, 
  count, 
  max, 
  min, 
  mode, 
  percentile, 
  rank, 
  stddev, 
  sum, 
  variance, 
  harmonicMean 
 */
export type AggFnEnum = (typeof AggFn)[keyof typeof AggFn]

export const Compression = {
  none: 0,
  compressed: 1,
} as const

export const CompressionInverse = {
  0: 'none',
  1: 'compressed',
} as const

/**
  none, 
  compressed 
 */
export type CompressionEnum = (typeof Compression)[keyof typeof Compression]

export const Interval = {
  none: 0,
  epoch: 1,
  hour: 2,
  minute: 3,
  second: 4,
  microseconds: 5,
  day: 6,
  doy: 7,
  dow: 8,
  isoDOW: 9,
  week: 10,
  month: 11,
  isoMonth: 12,
  quarter: 13,
  year: 14,
} as const

export const IntervalInverse = {
  0: 'none',
  1: 'epoch',
  2: 'hour',
  3: 'minute',
  4: 'second',
  5: 'microseconds',
  6: 'day',
  7: 'doy',
  8: 'dow',
  9: 'isoDOW',
  10: 'week',
  11: 'month',
  12: 'isoMonth',
  13: 'quarter',
  14: 'year',
} as const

/**
  none, 
  epoch, 
  hour, 
  minute, 
  second, 
  microseconds, 
  day, 
  doy, 
  dow, 
  isoDOW, 
  week, 
  month, 
  isoMonth, 
  quarter, 
  year 
 */
export type IntervalEnum = (typeof Interval)[keyof typeof Interval]

export const SortOrder = {
  asc: 0,
  desc: 1,
} as const

export const SortOrderInverse = {
  0: 'asc',
  1: 'desc',
} as const

/**
  asc, 
  desc 
 */
export type SortOrderEnum = (typeof SortOrder)[keyof typeof SortOrder]

export type SortHeader = {
  order: SortOrderEnum
  prop: number
  propType: PropTypeEnum
  start: number
  len: number
  lang: LangCodeEnum
}

export const SortHeaderByteSize = 8

export const writeSortHeader = (
  buf: Uint8Array,
  header: SortHeader,
  offset: number,
): number => {
  buf[offset] = header.order
  offset += 1
  buf[offset] = header.prop
  offset += 1
  buf[offset] = header.propType
  offset += 1
  writeUint16(buf, header.start, offset)
  offset += 2
  writeUint16(buf, header.len, offset)
  offset += 2
  buf[offset] = header.lang
  offset += 1
  return offset
}

export const writeSortHeaderProps = {
  order: (buf: Uint8Array, value: SortOrderEnum, offset: number) => {
    buf[offset] = value
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = value
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = value
  },
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 3)
  },
  len: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 5)
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 7] = value
  },
}

export const readSortHeader = (
  buf: Uint8Array,
  offset: number,
): SortHeader => {
  const value: SortHeader = {
    order: (buf[offset]) as SortOrderEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
    start: readUint16(buf, offset + 3),
    len: readUint16(buf, offset + 5),
    lang: (buf[offset + 7]) as LangCodeEnum,
  }
  return value
}

export const readSortHeaderProps = {
  order: (buf: Uint8Array, offset: number): SortOrderEnum => {
    return (buf[offset]) as SortOrderEnum
  },
  prop: (buf: Uint8Array, offset: number): number => {
    return buf[offset + 1]
  },
  propType: (buf: Uint8Array, offset: number): PropTypeEnum => {
    return (buf[offset + 2]) as PropTypeEnum
  },
  start: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 3)
  },
  len: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 5)
  },
  lang: (buf: Uint8Array, offset: number): LangCodeEnum => {
    return (buf[offset + 7]) as LangCodeEnum
  },
}

export const QuerySubType = {
  default: 0,
  filter: 1,
  sortAsc: 2,
  sortAscFilter: 3,
  sortDesc: 4,
  sortDescFilter: 5,
  sortIdDesc: 6,
  sortIdDescFilter: 7,
  search: 8,
  searchFilter: 9,
  searchSortAsc: 10,
  searchSortAscFilter: 11,
  searchSortDesc: 12,
  searchSortDescFilter: 13,
  searchSortIdDesc: 14,
  searchSortIdDescFilter: 15,
  vec: 16,
  vecFilter: 17,
  vecSortAsc: 18,
  vecSortAscFilter: 19,
  vecSortDesc: 20,
  vecSortDescFilter: 21,
  vecSortIdDesc: 22,
  vecSortIdDescFilter: 23,
} as const

export const QuerySubTypeInverse = {
  0: 'default',
  1: 'filter',
  2: 'sortAsc',
  3: 'sortAscFilter',
  4: 'sortDesc',
  5: 'sortDescFilter',
  6: 'sortIdDesc',
  7: 'sortIdDescFilter',
  8: 'search',
  9: 'searchFilter',
  10: 'searchSortAsc',
  11: 'searchSortAscFilter',
  12: 'searchSortDesc',
  13: 'searchSortDescFilter',
  14: 'searchSortIdDesc',
  15: 'searchSortIdDescFilter',
  16: 'vec',
  17: 'vecFilter',
  18: 'vecSortAsc',
  19: 'vecSortAscFilter',
  20: 'vecSortDesc',
  21: 'vecSortDescFilter',
  22: 'vecSortIdDesc',
  23: 'vecSortIdDescFilter',
} as const

/**
  default, 
  filter, 
  sortAsc, 
  sortAscFilter, 
  sortDesc, 
  sortDescFilter, 
  sortIdDesc, 
  sortIdDescFilter, 
  search, 
  searchFilter, 
  searchSortAsc, 
  searchSortAscFilter, 
  searchSortDesc, 
  searchSortDescFilter, 
  searchSortIdDesc, 
  searchSortIdDescFilter, 
  vec, 
  vecFilter, 
  vecSortAsc, 
  vecSortAscFilter, 
  vecSortDesc, 
  vecSortDescFilter, 
  vecSortIdDesc, 
  vecSortIdDescFilter 
 */
export type QuerySubTypeEnum = (typeof QuerySubType)[keyof typeof QuerySubType]

export type QueryDefaultHeader = {
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

export const writeQueryDefaultHeaderProps = {
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 2)
  },
  limit: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, value, offset + 6)
  },
  sortSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 10)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 12)
  },
  searchSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 14)
  },
  subType: (buf: Uint8Array, value: QuerySubTypeEnum, offset: number) => {
    buf[offset + 16] = value
  },
}

export const readQueryDefaultHeader = (
  buf: Uint8Array,
  offset: number,
): QueryDefaultHeader => {
  const value: QueryDefaultHeader = {
    typeId: (readUint16(buf, offset)) as TypeId,
    offset: readUint32(buf, offset + 2),
    limit: readUint32(buf, offset + 6),
    sortSize: readUint16(buf, offset + 10),
    filterSize: readUint16(buf, offset + 12),
    searchSize: readUint16(buf, offset + 14),
    subType: (buf[offset + 16]) as QuerySubTypeEnum,
  }
  return value
}

export const readQueryDefaultHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset)) as TypeId
  },
  offset: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 2)
  },
  limit: (buf: Uint8Array, offset: number): number => {
    return readUint32(buf, offset + 6)
  },
  sortSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 10)
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 12)
  },
  searchSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 14)
  },
  subType: (buf: Uint8Array, offset: number): QuerySubTypeEnum => {
    return (buf[offset + 16]) as QuerySubTypeEnum
  },
}

export type QueryIdHeader = {
  typeId: TypeId
  filterSize: number
}

export const QueryIdHeaderByteSize = 4

export const writeQueryIdHeader = (
  buf: Uint8Array,
  header: QueryIdHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  return offset
}

export const writeQueryIdHeaderProps = {
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
}

export const readQueryIdHeader = (
  buf: Uint8Array,
  offset: number,
): QueryIdHeader => {
  const value: QueryIdHeader = {
    typeId: (readUint16(buf, offset)) as TypeId,
    filterSize: readUint16(buf, offset + 2),
  }
  return value
}

export const readQueryIdHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset)) as TypeId
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
}

export type QueryIdsHeader = {
  typeId: TypeId
  filterSize: number
}

export const QueryIdsHeaderByteSize = 4

export const writeQueryIdsHeader = (
  buf: Uint8Array,
  header: QueryIdsHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  return offset
}

export const writeQueryIdsHeaderProps = {
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
}

export const readQueryIdsHeader = (
  buf: Uint8Array,
  offset: number,
): QueryIdsHeader => {
  const value: QueryIdsHeader = {
    typeId: (readUint16(buf, offset)) as TypeId,
    filterSize: readUint16(buf, offset + 2),
  }
  return value
}

export const readQueryIdsHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset)) as TypeId
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
}

export type QueryAliasHeader = {
  typeId: TypeId
  filterSize: number
  valueSize: number
}

export const QueryAliasHeaderByteSize = 6

export const writeQueryAliasHeader = (
  buf: Uint8Array,
  header: QueryAliasHeader,
  offset: number,
): number => {
  writeUint16(buf, header.typeId, offset)
  offset += 2
  writeUint16(buf, header.filterSize, offset)
  offset += 2
  writeUint16(buf, header.valueSize, offset)
  offset += 2
  return offset
}

export const writeQueryAliasHeaderProps = {
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, value, offset)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 2)
  },
  valueSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, value, offset + 4)
  },
}

export const readQueryAliasHeader = (
  buf: Uint8Array,
  offset: number,
): QueryAliasHeader => {
  const value: QueryAliasHeader = {
    typeId: (readUint16(buf, offset)) as TypeId,
    filterSize: readUint16(buf, offset + 2),
    valueSize: readUint16(buf, offset + 4),
  }
  return value
}

export const readQueryAliasHeaderProps = {
  typeId: (buf: Uint8Array, offset: number): TypeId => {
    return (readUint16(buf, offset)) as TypeId
  },
  filterSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 2)
  },
  valueSize: (buf: Uint8Array, offset: number): number => {
    return readUint16(buf, offset + 4)
  },
}

export const FilterOp = {
  equal: 1,
  has: 2,
  endsWith: 4,
  startsWith: 5,
  largerThen: 6,
  smallerThen: 7,
  largerThenInclusive: 8,
  smallerThenInclusive: 9,
  equalNormalize: 12,
  hasLowerCase: 13,
  startsWithNormalize: 14,
  endsWithNormalize: 15,
  equalCrc32: 17,
  like: 18,
} as const

export const FilterOpInverse = {
  1: 'equal',
  2: 'has',
  4: 'endsWith',
  5: 'startsWith',
  6: 'largerThen',
  7: 'smallerThen',
  8: 'largerThenInclusive',
  9: 'smallerThenInclusive',
  12: 'equalNormalize',
  13: 'hasLowerCase',
  14: 'startsWithNormalize',
  15: 'endsWithNormalize',
  17: 'equalCrc32',
  18: 'like',
} as const

/**
  equal, 
  has, 
  endsWith, 
  startsWith, 
  largerThen, 
  smallerThen, 
  largerThenInclusive, 
  smallerThenInclusive, 
  equalNormalize, 
  hasLowerCase, 
  startsWithNormalize, 
  endsWithNormalize, 
  equalCrc32, 
  like 
 */
export type FilterOpEnum = (typeof FilterOp)[keyof typeof FilterOp]

export const FilterType = {
  negate: 1,
  default: 2,
} as const

export const FilterTypeInverse = {
  1: 'negate',
  2: 'default',
} as const

/**
  negate, 
  default 
 */
export type FilterTypeEnum = (typeof FilterType)[keyof typeof FilterType]

export const FilterMode = {
  default: 0,
  orFixed: 1,
  orVar: 2,
  andFixed: 3,
  defaultVar: 4,
  reference: 5,
} as const

export const FilterModeInverse = {
  0: 'default',
  1: 'orFixed',
  2: 'orVar',
  3: 'andFixed',
  4: 'defaultVar',
  5: 'reference',
} as const

/**
  default, 
  orFixed, 
  orVar, 
  andFixed, 
  defaultVar, 
  reference 
 */
export type FilterModeEnum = (typeof FilterMode)[keyof typeof FilterMode]

export const FilterMeta = {
  references: 250,
  exists: 251,
  edge: 252,
  orBranch: 253,
  reference: 254,
  id: 255,
} as const

export const FilterMetaInverse = {
  250: 'references',
  251: 'exists',
  252: 'edge',
  253: 'orBranch',
  254: 'reference',
  255: 'id',
} as const

/**
  references, 
  exists, 
  edge, 
  orBranch, 
  reference, 
  id 
 */
// this needs number because it has a any (_) condition
export type FilterMetaEnum = 250 | 251 | 252 | 253 | 254 | 255 | (number & {})

export const FilterVectorFn = {
  dotProduct: 0,
  manhattanDistance: 1,
  cosineSimilarity: 2,
  euclideanDistance: 3,
} as const

export const FilterVectorFnInverse = {
  0: 'dotProduct',
  1: 'manhattanDistance',
  2: 'cosineSimilarity',
  3: 'euclideanDistance',
} as const

/**
  dotProduct, 
  manhattanDistance, 
  cosineSimilarity, 
  euclideanDistance 
 */
export type FilterVectorFnEnum = (typeof FilterVectorFn)[keyof typeof FilterVectorFn]

export const FilterMaxVectorScore = 9999999
export const FilterMaxStringScore = 255
export const FilterAlignment = {
  notSet: 255,
} as const

export const FilterAlignmentInverse = {
  255: 'notSet',
} as const

/**
  notSet 
 */
// this needs number because it has a any (_) condition
export type FilterAlignmentEnum = 255 | (number & {})

export const AggGroupedBy = {
  hasGroup: 255,
  none: 0,
} as const

export const AggGroupedByInverse = {
  255: 'hasGroup',
  0: 'none',
} as const

/**
  hasGroup, 
  none 
 */
export type AggGroupedByEnum = (typeof AggGroupedBy)[keyof typeof AggGroupedBy]

export const AggType = {
  sum: 1,
  count: 2,
  cardinality: 3,
  stddev: 4,
  average: 5,
  variance: 6,
  max: 7,
  min: 8,
  hmean: 9,
} as const

export const AggTypeInverse = {
  1: 'sum',
  2: 'count',
  3: 'cardinality',
  4: 'stddev',
  5: 'average',
  6: 'variance',
  7: 'max',
  8: 'min',
  9: 'hmean',
} as const

/**
  sum, 
  count, 
  cardinality, 
  stddev, 
  average, 
  variance, 
  max, 
  min, 
  hmean 
 */
export type AggTypeEnum = (typeof AggType)[keyof typeof AggType]

