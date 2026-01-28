import { 
  writeUint16, writeInt16, 
  writeUint32, writeInt32, 
  writeUint64, writeInt64, 
  writeFloatLE, writeDoubleLE,
  readUint16, readInt16, 
  readUint32, readInt32, 
  readUint64, readInt64, 
  readFloatLE, readDoubleLE
} from './utils/index.js'
import { AutoSizedUint8Array } from './db-client/modify/AutoSizedUint8Array.js'

export type TypeId = number

export const BridgeResponse = {
  query: 1,
  modify: 2,
  flushQuery: 3,
  flushModify: 4,
} as const

export const BridgeResponseInverse = {
  1: 'query',
  2: 'modify',
  3: 'flushQuery',
  4: 'flushModify',
} as const

/**
  query, 
  modify, 
  flushQuery, 
  flushModify 
 */
export type BridgeResponseEnum = (typeof BridgeResponse)[keyof typeof BridgeResponse]

export const OpType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCount: 5,
  aliasFilter: 8,
  idFilter: 9,
  referenceEdge: 10,
  subscribe: 11,
  unsubscribe: 14,
  blockHash: 42,
  blockStatuses: 43,
  saveBlock: 67,
  saveAll: 68,
  getSchemaIds: 70,
  modify: 127,
  loadBlock: 128,
  unloadBlock: 129,
  loadCommon: 130,
  createType: 131,
  setSchemaIds: 132,
  emptyMod: 133,
  noOp: 255,
} as const

export const OpTypeInverse = {
  0: 'id',
  1: 'ids',
  2: 'default',
  3: 'alias',
  4: 'aggregates',
  5: 'aggregatesCount',
  8: 'aliasFilter',
  9: 'idFilter',
  10: 'referenceEdge',
  11: 'subscribe',
  14: 'unsubscribe',
  42: 'blockHash',
  43: 'blockStatuses',
  67: 'saveBlock',
  68: 'saveAll',
  70: 'getSchemaIds',
  127: 'modify',
  128: 'loadBlock',
  129: 'unloadBlock',
  130: 'loadCommon',
  131: 'createType',
  132: 'setSchemaIds',
  133: 'emptyMod',
  255: 'noOp',
} as const

/**
  id, 
  ids, 
  default, 
  alias, 
  aggregates, 
  aggregatesCount, 
  aliasFilter, 
  idFilter, 
  referenceEdge, 
  subscribe, 
  unsubscribe, 
  blockHash, 
  blockStatuses, 
  saveBlock, 
  saveAll, 
  getSchemaIds, 
  modify, 
  loadBlock, 
  unloadBlock, 
  loadCommon, 
  createType, 
  setSchemaIds, 
  emptyMod, 
  noOp 
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
  deleteNode: 10,
  delete: 11,
  increment: 12,
  decrement: 13,
  expire: 14,
  addEmptySortText: 15,
  deleteTextField: 16,
  upsert: 17,
  insert: 18,
  end: 254,
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
  10: 'deleteNode',
  11: 'delete',
  12: 'increment',
  13: 'decrement',
  14: 'expire',
  15: 'addEmptySortText',
  16: 'deleteTextField',
  17: 'upsert',
  18: 'insert',
  254: 'end',
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
  deleteNode, 
  delete, 
  increment, 
  decrement, 
  expire, 
  addEmptySortText, 
  deleteTextField, 
  upsert, 
  insert, 
  end, 
  padding 
 */
export type ModOpEnum = (typeof ModOp)[keyof typeof ModOp]

export const Modify = {
  create: 0,
  update: 1,
  delete: 2,
} as const

export const ModifyInverse = {
  0: 'create',
  1: 'update',
  2: 'delete',
} as const

/**
  create, 
  update, 
  delete 
 */
export type ModifyEnum = (typeof Modify)[keyof typeof Modify]

export type ModifyHeader = {
  opId: number
  opType: OpTypeEnum
  schema: number
  count: number
}

export const ModifyHeaderByteSize = 17

export const ModifyHeaderAlignOf = 16

export const packModifyHeader = (obj: ModifyHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.opId) & 4294967295n) << 0n
  val |= (BigInt(obj.opType) & 255n) << 32n
  val |= (BigInt(obj.schema) & 18446744073709551615n) << 40n
  val |= (BigInt(obj.count) & 4294967295n) << 104n
  return val
}

export const unpackModifyHeader = (val: bigint): ModifyHeader => {
  return {
    opId: Number((val >> 0n) & 4294967295n),
    opType: (Number((val >> 32n) & 255n)) as OpTypeEnum,
    schema: Number((val >> 40n) & 18446744073709551615n),
    count: Number((val >> 104n) & 4294967295n),
  }
}

export const writeModifyHeader = (
  buf: Uint8Array,
  header: ModifyHeader,
  offset: number,
): number => {
  writeUint32(buf, Number(header.opId), offset)
  offset += 4
  buf[offset] = Number(header.opType)
  offset += 1
  writeUint64(buf, header.schema, offset)
  offset += 8
  writeUint32(buf, Number(header.count), offset)
  offset += 4
  return offset
}

export const writeModifyHeaderProps = {
  opId: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  opType: (buf: Uint8Array, value: OpTypeEnum, offset: number) => {
    buf[offset + 4] = Number(value)
  },
  schema: (buf: Uint8Array, value: number, offset: number) => {
    writeUint64(buf, value, offset + 5)
  },
  count: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 13)
  },
}

export const readModifyHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyHeader => {
  const value: ModifyHeader = {
    opId: readUint32(buf, offset),
    opType: (buf[offset + 4]) as OpTypeEnum,
    schema: readUint64(buf, offset + 5),
    count: readUint32(buf, offset + 13),
  }
  return value
}

export const readModifyHeaderProps = {
    opId: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    opType: (buf: Uint8Array, offset: number) => (buf[offset + 4]) as OpTypeEnum,
    schema: (buf: Uint8Array, offset: number) => readUint64(buf, offset + 5),
    count: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 13),
}

export const createModifyHeader = (header: ModifyHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyHeaderByteSize)
  writeModifyHeader(buffer, header, 0)
  return buffer
}

export const pushModifyHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyHeader,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.opId))
  buf.pushU8(Number(header.opType))
  buf.pushU64(header.schema)
  buf.pushU32(Number(header.count))
  return index
}

export type ModifyUpdateHeader = {
  op: ModifyEnum
  type: number
  id: number
  size: number
}

export const ModifyUpdateHeaderByteSize = 10

export const ModifyUpdateHeaderAlignOf = 16

export const packModifyUpdateHeader = (obj: ModifyUpdateHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.type) & 255n) << 8n
  val |= (BigInt(obj.id) & 4294967295n) << 16n
  val |= (BigInt(obj.size) & 4294967295n) << 48n
  return val
}

export const unpackModifyUpdateHeader = (val: bigint): ModifyUpdateHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as ModifyEnum,
    type: Number((val >> 8n) & 255n),
    id: Number((val >> 16n) & 4294967295n),
    size: Number((val >> 48n) & 4294967295n),
  }
}

export const writeModifyUpdateHeader = (
  buf: Uint8Array,
  header: ModifyUpdateHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.type)
  offset += 1
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyUpdateHeaderProps = {
  op: (buf: Uint8Array, value: ModifyEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  type: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 2)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 6)
  },
}

export const readModifyUpdateHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyUpdateHeader => {
  const value: ModifyUpdateHeader = {
    op: (buf[offset]) as ModifyEnum,
    type: buf[offset + 1],
    id: readUint32(buf, offset + 2),
    size: readUint32(buf, offset + 6),
  }
  return value
}

export const readModifyUpdateHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as ModifyEnum,
    type: (buf: Uint8Array, offset: number) => buf[offset + 1],
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 2),
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 6),
}

export const createModifyUpdateHeader = (header: ModifyUpdateHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyUpdateHeaderByteSize)
  writeModifyUpdateHeader(buffer, header, 0)
  return buffer
}

export const pushModifyUpdateHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyUpdateHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.type))
  buf.pushU32(Number(header.id))
  buf.pushU32(Number(header.size))
  return index
}

export type ModifyDeleteHeader = {
  op: ModifyEnum
  type: number
  id: number
}

export const ModifyDeleteHeaderByteSize = 6

export const ModifyDeleteHeaderAlignOf = 8

export const packModifyDeleteHeader = (obj: ModifyDeleteHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.type) & 255n) << 8n
  val |= (BigInt(obj.id) & 4294967295n) << 16n
  return val
}

export const unpackModifyDeleteHeader = (val: bigint): ModifyDeleteHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as ModifyEnum,
    type: Number((val >> 8n) & 255n),
    id: Number((val >> 16n) & 4294967295n),
  }
}

export const writeModifyDeleteHeader = (
  buf: Uint8Array,
  header: ModifyDeleteHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.type)
  offset += 1
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  return offset
}

export const writeModifyDeleteHeaderProps = {
  op: (buf: Uint8Array, value: ModifyEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  type: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 2)
  },
}

export const readModifyDeleteHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyDeleteHeader => {
  const value: ModifyDeleteHeader = {
    op: (buf[offset]) as ModifyEnum,
    type: buf[offset + 1],
    id: readUint32(buf, offset + 2),
  }
  return value
}

export const readModifyDeleteHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as ModifyEnum,
    type: (buf: Uint8Array, offset: number) => buf[offset + 1],
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 2),
}

export const createModifyDeleteHeader = (header: ModifyDeleteHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyDeleteHeaderByteSize)
  writeModifyDeleteHeader(buffer, header, 0)
  return buffer
}

export const pushModifyDeleteHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyDeleteHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.type))
  buf.pushU32(Number(header.id))
  return index
}

export type ModifyCreateHeader = {
  op: ModifyEnum
  type: number
  size: number
}

export const ModifyCreateHeaderByteSize = 6

export const ModifyCreateHeaderAlignOf = 8

export const packModifyCreateHeader = (obj: ModifyCreateHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.type) & 255n) << 8n
  val |= (BigInt(obj.size) & 4294967295n) << 16n
  return val
}

export const unpackModifyCreateHeader = (val: bigint): ModifyCreateHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as ModifyEnum,
    type: Number((val >> 8n) & 255n),
    size: Number((val >> 16n) & 4294967295n),
  }
}

export const writeModifyCreateHeader = (
  buf: Uint8Array,
  header: ModifyCreateHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.type)
  offset += 1
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyCreateHeaderProps = {
  op: (buf: Uint8Array, value: ModifyEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  type: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 2)
  },
}

export const readModifyCreateHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyCreateHeader => {
  const value: ModifyCreateHeader = {
    op: (buf[offset]) as ModifyEnum,
    type: buf[offset + 1],
    size: readUint32(buf, offset + 2),
  }
  return value
}

export const readModifyCreateHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as ModifyEnum,
    type: (buf: Uint8Array, offset: number) => buf[offset + 1],
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 2),
}

export const createModifyCreateHeader = (header: ModifyCreateHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyCreateHeaderByteSize)
  writeModifyCreateHeader(buffer, header, 0)
  return buffer
}

export const pushModifyCreateHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyCreateHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.type))
  buf.pushU32(Number(header.size))
  return index
}

export type ModifyMainHeader = {
  id: number
  start: number
  size: number
}

export const ModifyMainHeaderByteSize = 5

export const ModifyMainHeaderAlignOf = 8

export const packModifyMainHeader = (obj: ModifyMainHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.id) & 255n) << 0n
  val |= (BigInt(obj.start) & 65535n) << 8n
  val |= (BigInt(obj.size) & 65535n) << 24n
  return val
}

export const unpackModifyMainHeader = (val: bigint): ModifyMainHeader => {
  return {
    id: Number((val >> 0n) & 255n),
    start: Number((val >> 8n) & 65535n),
    size: Number((val >> 24n) & 65535n),
  }
}

export const writeModifyMainHeader = (
  buf: Uint8Array,
  header: ModifyMainHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.id)
  offset += 1
  writeUint16(buf, Number(header.start), offset)
  offset += 2
  writeUint16(buf, Number(header.size), offset)
  offset += 2
  return offset
}

export const writeModifyMainHeaderProps = {
  id: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = Number(value)
  },
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 1)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 3)
  },
}

export const readModifyMainHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyMainHeader => {
  const value: ModifyMainHeader = {
    id: buf[offset],
    start: readUint16(buf, offset + 1),
    size: readUint16(buf, offset + 3),
  }
  return value
}

export const readModifyMainHeaderProps = {
    id: (buf: Uint8Array, offset: number) => buf[offset],
    start: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 1),
    size: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 3),
}

export const createModifyMainHeader = (header: ModifyMainHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyMainHeaderByteSize)
  writeModifyMainHeader(buffer, header, 0)
  return buffer
}

export const pushModifyMainHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyMainHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.id))
  buf.pushU16(Number(header.start))
  buf.pushU16(Number(header.size))
  return index
}

export type ModifyPropHeader = {
  id: number
  type: PropTypeEnum
  size: number
}

export const ModifyPropHeaderByteSize = 6

export const ModifyPropHeaderAlignOf = 8

export const packModifyPropHeader = (obj: ModifyPropHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.id) & 255n) << 0n
  val |= (BigInt(obj.type) & 255n) << 8n
  val |= (BigInt(obj.size) & 4294967295n) << 16n
  return val
}

export const unpackModifyPropHeader = (val: bigint): ModifyPropHeader => {
  return {
    id: Number((val >> 0n) & 255n),
    type: (Number((val >> 8n) & 255n)) as PropTypeEnum,
    size: Number((val >> 16n) & 4294967295n),
  }
}

export const writeModifyPropHeader = (
  buf: Uint8Array,
  header: ModifyPropHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.id)
  offset += 1
  buf[offset] = Number(header.type)
  offset += 1
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyPropHeaderProps = {
  id: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = Number(value)
  },
  type: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 2)
  },
}

export const readModifyPropHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyPropHeader => {
  const value: ModifyPropHeader = {
    id: buf[offset],
    type: (buf[offset + 1]) as PropTypeEnum,
    size: readUint32(buf, offset + 2),
  }
  return value
}

export const readModifyPropHeaderProps = {
    id: (buf: Uint8Array, offset: number) => buf[offset],
    type: (buf: Uint8Array, offset: number) => (buf[offset + 1]) as PropTypeEnum,
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 2),
}

export const createModifyPropHeader = (header: ModifyPropHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyPropHeaderByteSize)
  writeModifyPropHeader(buffer, header, 0)
  return buffer
}

export const pushModifyPropHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyPropHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.id))
  buf.pushU8(Number(header.type))
  buf.pushU32(Number(header.size))
  return index
}

export const ModifyReferences = {
  clear: 0,
  ids: 1,
  idsWithMeta: 2,
  tmpIds: 3,
  delIds: 4,
  delTmpIds: 5,
} as const

export const ModifyReferencesInverse = {
  0: 'clear',
  1: 'ids',
  2: 'idsWithMeta',
  3: 'tmpIds',
  4: 'delIds',
  5: 'delTmpIds',
} as const

/**
  clear, 
  ids, 
  idsWithMeta, 
  tmpIds, 
  delIds, 
  delTmpIds 
 */
export type ModifyReferencesEnum = (typeof ModifyReferences)[keyof typeof ModifyReferences]

export type ModifyReferencesHeader = {
  op: ModifyReferencesEnum
  size: number
}

export const ModifyReferencesHeaderByteSize = 5

export const ModifyReferencesHeaderAlignOf = 8

export const packModifyReferencesHeader = (obj: ModifyReferencesHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.size) & 4294967295n) << 8n
  return val
}

export const unpackModifyReferencesHeader = (val: bigint): ModifyReferencesHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as ModifyReferencesEnum,
    size: Number((val >> 8n) & 4294967295n),
  }
}

export const writeModifyReferencesHeader = (
  buf: Uint8Array,
  header: ModifyReferencesHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyReferencesHeaderProps = {
  op: (buf: Uint8Array, value: ModifyReferencesEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 1)
  },
}

export const readModifyReferencesHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyReferencesHeader => {
  const value: ModifyReferencesHeader = {
    op: (buf[offset]) as ModifyReferencesEnum,
    size: readUint32(buf, offset + 1),
  }
  return value
}

export const readModifyReferencesHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as ModifyReferencesEnum,
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 1),
}

export const createModifyReferencesHeader = (header: ModifyReferencesHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyReferencesHeaderByteSize)
  writeModifyReferencesHeader(buffer, header, 0)
  return buffer
}

export const pushModifyReferencesHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyReferencesHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU32(Number(header.size))
  return index
}

export type ModifyReferencesMetaHeader = {
  id: number
  isTmp: boolean
  withIndex: boolean
  index: number
  size: number
}

export const ModifyReferencesMetaHeaderByteSize = 13

export const ModifyReferencesMetaHeaderAlignOf = 16

export const packModifyReferencesMetaHeader = (obj: ModifyReferencesMetaHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.id) & 4294967295n) << 0n
  val |= ((obj.isTmp ? 1n : 0n) & 1n) << 32n
  val |= ((obj.withIndex ? 1n : 0n) & 1n) << 33n
  val |= (BigInt(obj.index) & 4294967295n) << 40n
  val |= (BigInt(obj.size) & 4294967295n) << 72n
  return val
}

export const unpackModifyReferencesMetaHeader = (val: bigint): ModifyReferencesMetaHeader => {
  return {
    id: Number((val >> 0n) & 4294967295n),
    isTmp: ((val >> 32n) & 1n) === 1n,
    withIndex: ((val >> 33n) & 1n) === 1n,
    index: Number((val >> 40n) & 4294967295n),
    size: Number((val >> 72n) & 4294967295n),
  }
}

export const writeModifyReferencesMetaHeader = (
  buf: Uint8Array,
  header: ModifyReferencesMetaHeader,
  offset: number,
): number => {
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  buf[offset] = 0
  buf[offset] |= (((header.isTmp ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= (((header.withIndex ? 1 : 0) >>> 0) & 1) << 1
  buf[offset] |= ((0 >>> 0) & 63) << 2
  offset += 1
  writeUint32(buf, Number(header.index), offset)
  offset += 4
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyReferencesMetaHeaderProps = {
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  isTmp: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  withIndex: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 1
  },
  index: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 5)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 9)
  },
}

export const readModifyReferencesMetaHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyReferencesMetaHeader => {
  const value: ModifyReferencesMetaHeader = {
    id: readUint32(buf, offset),
    isTmp: (((buf[offset + 4] >>> 0) & 1)) === 1,
    withIndex: (((buf[offset + 4] >>> 1) & 1)) === 1,
    index: readUint32(buf, offset + 5),
    size: readUint32(buf, offset + 9),
  }
  return value
}

export const readModifyReferencesMetaHeaderProps = {
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    isTmp: (buf: Uint8Array, offset: number) => (((buf[offset + 4] >>> 0) & 1)) === 1,
    withIndex: (buf: Uint8Array, offset: number) => (((buf[offset + 4] >>> 1) & 1)) === 1,
    index: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 5),
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 9),
}

export const createModifyReferencesMetaHeader = (header: ModifyReferencesMetaHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyReferencesMetaHeaderByteSize)
  writeModifyReferencesMetaHeader(buffer, header, 0)
  return buffer
}

export const pushModifyReferencesMetaHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyReferencesMetaHeader,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.id))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.isTmp ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= (((header.withIndex ? 1 : 0) >>> 0) & 1) << 1
  buf.view[buf.length - 1] |= ((0 >>> 0) & 63) << 2
  buf.pushU32(Number(header.index))
  buf.pushU32(Number(header.size))
  return index
}

export type ModifyReferenceMetaHeader = {
  id: number
  isTmp: boolean
  size: number
}

export const ModifyReferenceMetaHeaderByteSize = 9

export const ModifyReferenceMetaHeaderAlignOf = 16

export const packModifyReferenceMetaHeader = (obj: ModifyReferenceMetaHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.id) & 4294967295n) << 0n
  val |= ((obj.isTmp ? 1n : 0n) & 1n) << 32n
  val |= (BigInt(obj.size) & 4294967295n) << 40n
  return val
}

export const unpackModifyReferenceMetaHeader = (val: bigint): ModifyReferenceMetaHeader => {
  return {
    id: Number((val >> 0n) & 4294967295n),
    isTmp: ((val >> 32n) & 1n) === 1n,
    size: Number((val >> 40n) & 4294967295n),
  }
}

export const writeModifyReferenceMetaHeader = (
  buf: Uint8Array,
  header: ModifyReferenceMetaHeader,
  offset: number,
): number => {
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  buf[offset] = 0
  buf[offset] |= (((header.isTmp ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeModifyReferenceMetaHeaderProps = {
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  isTmp: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 5)
  },
}

export const readModifyReferenceMetaHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyReferenceMetaHeader => {
  const value: ModifyReferenceMetaHeader = {
    id: readUint32(buf, offset),
    isTmp: (((buf[offset + 4] >>> 0) & 1)) === 1,
    size: readUint32(buf, offset + 5),
  }
  return value
}

export const readModifyReferenceMetaHeaderProps = {
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    isTmp: (buf: Uint8Array, offset: number) => (((buf[offset + 4] >>> 0) & 1)) === 1,
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 5),
}

export const createModifyReferenceMetaHeader = (header: ModifyReferenceMetaHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyReferenceMetaHeaderByteSize)
  writeModifyReferenceMetaHeader(buffer, header, 0)
  return buffer
}

export const pushModifyReferenceMetaHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyReferenceMetaHeader,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.id))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.isTmp ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= ((0 >>> 0) & 127) << 1
  buf.pushU32(Number(header.size))
  return index
}

export type ModifyCardinalityHeader = {
  sparse: boolean
  precision: number
}

export const ModifyCardinalityHeaderByteSize = 2

export const ModifyCardinalityHeaderAlignOf = 2

export const packModifyCardinalityHeader = (obj: ModifyCardinalityHeader): bigint => {
  let val = 0n
  val |= ((obj.sparse ? 1n : 0n) & 1n) << 0n
  val |= (BigInt(obj.precision) & 255n) << 8n
  return val
}

export const unpackModifyCardinalityHeader = (val: bigint): ModifyCardinalityHeader => {
  return {
    sparse: ((val >> 0n) & 1n) === 1n,
    precision: Number((val >> 8n) & 255n),
  }
}

export const writeModifyCardinalityHeader = (
  buf: Uint8Array,
  header: ModifyCardinalityHeader,
  offset: number,
): number => {
  buf[offset] = 0
  buf[offset] |= (((header.sparse ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  buf[offset] = Number(header.precision)
  offset += 1
  return offset
}

export const writeModifyCardinalityHeaderProps = {
  sparse: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  precision: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
}

export const readModifyCardinalityHeader = (
  buf: Uint8Array,
  offset: number,
): ModifyCardinalityHeader => {
  const value: ModifyCardinalityHeader = {
    sparse: (((buf[offset] >>> 0) & 1)) === 1,
    precision: buf[offset + 1],
  }
  return value
}

export const readModifyCardinalityHeaderProps = {
    sparse: (buf: Uint8Array, offset: number) => (((buf[offset] >>> 0) & 1)) === 1,
    precision: (buf: Uint8Array, offset: number) => buf[offset + 1],
}

export const createModifyCardinalityHeader = (header: ModifyCardinalityHeader): Uint8Array => {
  const buffer = new Uint8Array(ModifyCardinalityHeaderByteSize)
  writeModifyCardinalityHeader(buffer, header, 0)
  return buffer
}

export const pushModifyCardinalityHeader = (
  buf: AutoSizedUint8Array,
  header: ModifyCardinalityHeader,
): number => {
  const index = buf.length
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.sparse ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= ((0 >>> 0) & 127) << 1
  buf.pushU8(Number(header.precision))
  return index
}

export type ModifyResultItem = {
  id: number
  err: ModifyErrorEnum
}

export const ModifyResultItemByteSize = 5

export const ModifyResultItemAlignOf = 8

export const packModifyResultItem = (obj: ModifyResultItem): bigint => {
  let val = 0n
  val |= (BigInt(obj.id) & 4294967295n) << 0n
  val |= (BigInt(obj.err) & 255n) << 32n
  return val
}

export const unpackModifyResultItem = (val: bigint): ModifyResultItem => {
  return {
    id: Number((val >> 0n) & 4294967295n),
    err: (Number((val >> 32n) & 255n)) as ModifyErrorEnum,
  }
}

export const writeModifyResultItem = (
  buf: Uint8Array,
  header: ModifyResultItem,
  offset: number,
): number => {
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  buf[offset] = Number(header.err)
  offset += 1
  return offset
}

export const writeModifyResultItemProps = {
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  err: (buf: Uint8Array, value: ModifyErrorEnum, offset: number) => {
    buf[offset + 4] = Number(value)
  },
}

export const readModifyResultItem = (
  buf: Uint8Array,
  offset: number,
): ModifyResultItem => {
  const value: ModifyResultItem = {
    id: readUint32(buf, offset),
    err: (buf[offset + 4]) as ModifyErrorEnum,
  }
  return value
}

export const readModifyResultItemProps = {
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    err: (buf: Uint8Array, offset: number) => (buf[offset + 4]) as ModifyErrorEnum,
}

export const createModifyResultItem = (header: ModifyResultItem): Uint8Array => {
  const buffer = new Uint8Array(ModifyResultItemByteSize)
  writeModifyResultItem(buffer, header, 0)
  return buffer
}

export const pushModifyResultItem = (
  buf: AutoSizedUint8Array,
  header: ModifyResultItem,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.id))
  buf.pushU8(Number(header.err))
  return index
}

export const ModifyError = {
  null: 0,
  nx: 1,
  unknown: 2,
} as const

export const ModifyErrorInverse = {
  0: 'null',
  1: 'nx',
  2: 'unknown',
} as const

/**
  null, 
  nx, 
  unknown 
 */
export type ModifyErrorEnum = (typeof ModifyError)[keyof typeof ModifyError]

export const PropType = {
  null: 0,
  timestamp: 1,
  number: 4,
  cardinality: 5,
  uint8: 6,
  uint32: 7,
  boolean: 9,
  enum: 10,
  string: 11,
  stringFixed: 12,
  text: 13,
  reference: 15,
  references: 16,
  microBuffer: 17,
  alias: 18,
  aliases: 19,
  int8: 20,
  int16: 21,
  uint16: 22,
  int32: 23,
  binary: 25,
  binaryFixed: 26,
  vector: 27,
  json: 28,
  jsonFixed: 29,
  object: 30,
  colVec: 31,
  id: 255,
} as const

export const PropTypeInverse = {
  0: 'null',
  1: 'timestamp',
  4: 'number',
  5: 'cardinality',
  6: 'uint8',
  7: 'uint32',
  9: 'boolean',
  10: 'enum',
  11: 'string',
  12: 'stringFixed',
  13: 'text',
  15: 'reference',
  16: 'references',
  17: 'microBuffer',
  18: 'alias',
  19: 'aliases',
  20: 'int8',
  21: 'int16',
  22: 'uint16',
  23: 'int32',
  25: 'binary',
  26: 'binaryFixed',
  27: 'vector',
  28: 'json',
  29: 'jsonFixed',
  30: 'object',
  31: 'colVec',
  255: 'id',
} as const

/**
  null, 
  timestamp, 
  number, 
  cardinality, 
  uint8, 
  uint32, 
  boolean, 
  enum, 
  string, 
  stringFixed, 
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
  binaryFixed, 
  vector, 
  json, 
  jsonFixed, 
  object, 
  colVec, 
  id 
 */
export type PropTypeEnum = (typeof PropType)[keyof typeof PropType]

export const RefOp = {
  clear: 0,
  del: 1,
  end: ModOp.end,
  set: 3,
  setEdge: 4,
} as const

export const RefOpInverse = {
  0: 'clear',
  1: 'del',
  [ModOp.end]: 'end',
  3: 'set',
  4: 'setEdge',
} as const

/**
  clear, 
  del, 
  end, 
  set, 
  setEdge 
 */
export type RefOpEnum = (typeof RefOp)[keyof typeof RefOp]

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
  none: 0,
  aa: 1,
  ab: 2,
  af: 3,
  ak: 4,
  sq: 5,
  am: 6,
  ar: 7,
  an: 8,
  hy: 9,
  as: 10,
  av: 11,
  ae: 12,
  ay: 13,
  az: 14,
  eu: 15,
  be: 16,
  bn: 17,
  bi: 18,
  bs: 19,
  br: 20,
  bg: 21,
  my: 22,
  ca: 23,
  km: 24,
  ce: 25,
  zh: 26,
  cv: 27,
  kw: 28,
  co: 29,
  hr: 30,
  cs: 31,
  da: 32,
  dv: 33,
  nl: 34,
  dz: 35,
  en: 36,
  et: 37,
  fo: 38,
  fi: 39,
  fr: 40,
  ff: 41,
  gd: 42,
  gl: 43,
  de: 44,
  gsw: 45,
  el: 46,
  kl: 47,
  gu: 48,
  ht: 49,
  ha: 50,
  he: 51,
  hi: 52,
  hu: 53,
  is: 54,
  ig: 55,
  id: 56,
  ia: 57,
  iu: 58,
  ik: 59,
  ga: 60,
  it: 61,
  ja: 62,
  kn: 63,
  ks: 64,
  kk: 65,
  rw: 66,
  ko: 67,
  ku: 68,
  ky: 69,
  lo: 70,
  la: 71,
  lv: 72,
  lb: 73,
  li: 74,
  ln: 75,
  lt: 76,
  mk: 77,
  mg: 78,
  ms: 79,
  ml: 80,
  mt: 81,
  gv: 82,
  mi: 83,
  ro: 84,
  mn: 85,
  ne: 86,
  se: 87,
  no: 88,
  nb: 89,
  nn: 90,
  oc: 91,
  or: 92,
  om: 93,
  os: 94,
  pa: 95,
  ps: 96,
  fa: 97,
  pl: 98,
  pt: 99,
  qu: 100,
  rm: 101,
  ru: 102,
  sm: 103,
  sa: 104,
  sc: 105,
  sr: 106,
  sd: 107,
  si: 108,
  sk: 109,
  sl: 110,
  so: 111,
  st: 112,
  nr: 113,
  es: 114,
  sw: 115,
  ss: 116,
  sv: 117,
  tl: 118,
  tg: 119,
  ta: 120,
  tt: 121,
  te: 122,
  th: 123,
  bo: 124,
  ti: 125,
  to: 126,
  ts: 127,
  tn: 128,
  tr: 129,
  tk: 130,
  ug: 131,
  uk: 132,
  ur: 133,
  uz: 134,
  ve: 135,
  vi: 136,
  wa: 137,
  cy: 138,
  fy: 139,
  wo: 140,
  xh: 141,
  yi: 142,
  yo: 143,
  zu: 144,
  ka: 145,
  cnr: 146,
} as const

export const LangCodeInverse = {
  0: 'none',
  1: 'aa',
  2: 'ab',
  3: 'af',
  4: 'ak',
  5: 'sq',
  6: 'am',
  7: 'ar',
  8: 'an',
  9: 'hy',
  10: 'as',
  11: 'av',
  12: 'ae',
  13: 'ay',
  14: 'az',
  15: 'eu',
  16: 'be',
  17: 'bn',
  18: 'bi',
  19: 'bs',
  20: 'br',
  21: 'bg',
  22: 'my',
  23: 'ca',
  24: 'km',
  25: 'ce',
  26: 'zh',
  27: 'cv',
  28: 'kw',
  29: 'co',
  30: 'hr',
  31: 'cs',
  32: 'da',
  33: 'dv',
  34: 'nl',
  35: 'dz',
  36: 'en',
  37: 'et',
  38: 'fo',
  39: 'fi',
  40: 'fr',
  41: 'ff',
  42: 'gd',
  43: 'gl',
  44: 'de',
  45: 'gsw',
  46: 'el',
  47: 'kl',
  48: 'gu',
  49: 'ht',
  50: 'ha',
  51: 'he',
  52: 'hi',
  53: 'hu',
  54: 'is',
  55: 'ig',
  56: 'id',
  57: 'ia',
  58: 'iu',
  59: 'ik',
  60: 'ga',
  61: 'it',
  62: 'ja',
  63: 'kn',
  64: 'ks',
  65: 'kk',
  66: 'rw',
  67: 'ko',
  68: 'ku',
  69: 'ky',
  70: 'lo',
  71: 'la',
  72: 'lv',
  73: 'lb',
  74: 'li',
  75: 'ln',
  76: 'lt',
  77: 'mk',
  78: 'mg',
  79: 'ms',
  80: 'ml',
  81: 'mt',
  82: 'gv',
  83: 'mi',
  84: 'ro',
  85: 'mn',
  86: 'ne',
  87: 'se',
  88: 'no',
  89: 'nb',
  90: 'nn',
  91: 'oc',
  92: 'or',
  93: 'om',
  94: 'os',
  95: 'pa',
  96: 'ps',
  97: 'fa',
  98: 'pl',
  99: 'pt',
  100: 'qu',
  101: 'rm',
  102: 'ru',
  103: 'sm',
  104: 'sa',
  105: 'sc',
  106: 'sr',
  107: 'sd',
  108: 'si',
  109: 'sk',
  110: 'sl',
  111: 'so',
  112: 'st',
  113: 'nr',
  114: 'es',
  115: 'sw',
  116: 'ss',
  117: 'sv',
  118: 'tl',
  119: 'tg',
  120: 'ta',
  121: 'tt',
  122: 'te',
  123: 'th',
  124: 'bo',
  125: 'ti',
  126: 'to',
  127: 'ts',
  128: 'tn',
  129: 'tr',
  130: 'tk',
  131: 'ug',
  132: 'uk',
  133: 'ur',
  134: 'uz',
  135: 've',
  136: 'vi',
  137: 'wa',
  138: 'cy',
  139: 'fy',
  140: 'wo',
  141: 'xh',
  142: 'yi',
  143: 'yo',
  144: 'zu',
  145: 'ka',
  146: 'cnr',
} as const

/**
  none, 
  aa, 
  ab, 
  af, 
  ak, 
  sq, 
  am, 
  ar, 
  an, 
  hy, 
  as, 
  av, 
  ae, 
  ay, 
  az, 
  eu, 
  be, 
  bn, 
  bi, 
  bs, 
  br, 
  bg, 
  my, 
  ca, 
  km, 
  ce, 
  zh, 
  cv, 
  kw, 
  co, 
  hr, 
  cs, 
  da, 
  dv, 
  nl, 
  dz, 
  en, 
  et, 
  fo, 
  fi, 
  fr, 
  ff, 
  gd, 
  gl, 
  de, 
  gsw, 
  el, 
  kl, 
  gu, 
  ht, 
  ha, 
  he, 
  hi, 
  hu, 
  is, 
  ig, 
  id, 
  ia, 
  iu, 
  ik, 
  ga, 
  it, 
  ja, 
  kn, 
  ks, 
  kk, 
  rw, 
  ko, 
  ku, 
  ky, 
  lo, 
  la, 
  lv, 
  lb, 
  li, 
  ln, 
  lt, 
  mk, 
  mg, 
  ms, 
  ml, 
  mt, 
  gv, 
  mi, 
  ro, 
  mn, 
  ne, 
  se, 
  no, 
  nb, 
  nn, 
  oc, 
  or, 
  om, 
  os, 
  pa, 
  ps, 
  fa, 
  pl, 
  pt, 
  qu, 
  rm, 
  ru, 
  sm, 
  sa, 
  sc, 
  sr, 
  sd, 
  si, 
  sk, 
  sl, 
  so, 
  st, 
  nr, 
  es, 
  sw, 
  ss, 
  sv, 
  tl, 
  tg, 
  ta, 
  tt, 
  te, 
  th, 
  bo, 
  ti, 
  to, 
  ts, 
  tn, 
  tr, 
  tk, 
  ug, 
  uk, 
  ur, 
  uz, 
  ve, 
  vi, 
  wa, 
  cy, 
  fy, 
  wo, 
  xh, 
  yi, 
  yo, 
  zu, 
  ka, 
  cnr 
 */
export type LangCodeEnum = (typeof LangCode)[keyof typeof LangCode]

export const MAIN_PROP = 0
export const ID_PROP = 255

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

export const AggFunction = {
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
  hmean: 13,
} as const

export const AggFunctionInverse = {
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
  13: 'hmean',
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
  hmean 
 */
export type AggFunctionEnum = (typeof AggFunction)[keyof typeof AggFunction]

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

export const Order = {
  asc: 0,
  desc: 1,
} as const

export const OrderInverse = {
  0: 'asc',
  1: 'desc',
} as const

/**
  asc, 
  desc 
 */
export type OrderEnum = (typeof Order)[keyof typeof Order]

export type SortHeader = {
  order: OrderEnum
  prop: number
  propType: PropTypeEnum
  start: number
  len: number
  lang: LangCodeEnum
  edgeType: number
}

export const SortHeaderByteSize = 10

export const SortHeaderAlignOf = 16

export const packSortHeader = (obj: SortHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.order) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.propType) & 255n) << 16n
  val |= (BigInt(obj.start) & 65535n) << 24n
  val |= (BigInt(obj.len) & 65535n) << 40n
  val |= (BigInt(obj.lang) & 255n) << 56n
  val |= (BigInt(obj.edgeType) & 65535n) << 64n
  return val
}

export const unpackSortHeader = (val: bigint): SortHeader => {
  return {
    order: (Number((val >> 0n) & 255n)) as OrderEnum,
    prop: Number((val >> 8n) & 255n),
    propType: (Number((val >> 16n) & 255n)) as PropTypeEnum,
    start: Number((val >> 24n) & 65535n),
    len: Number((val >> 40n) & 65535n),
    lang: (Number((val >> 56n) & 255n)) as LangCodeEnum,
    edgeType: Number((val >> 64n) & 65535n),
  }
}

export const writeSortHeader = (
  buf: Uint8Array,
  header: SortHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.order)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  writeUint16(buf, Number(header.start), offset)
  offset += 2
  writeUint16(buf, Number(header.len), offset)
  offset += 2
  buf[offset] = Number(header.lang)
  offset += 1
  writeUint16(buf, Number(header.edgeType), offset)
  offset += 2
  return offset
}

export const writeSortHeaderProps = {
  order: (buf: Uint8Array, value: OrderEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = Number(value)
  },
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 3)
  },
  len: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 5)
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 7] = Number(value)
  },
  edgeType: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 8)
  },
}

export const readSortHeader = (
  buf: Uint8Array,
  offset: number,
): SortHeader => {
  const value: SortHeader = {
    order: (buf[offset]) as OrderEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
    start: readUint16(buf, offset + 3),
    len: readUint16(buf, offset + 5),
    lang: (buf[offset + 7]) as LangCodeEnum,
    edgeType: readUint16(buf, offset + 8),
  }
  return value
}

export const readSortHeaderProps = {
    order: (buf: Uint8Array, offset: number) => (buf[offset]) as OrderEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 2]) as PropTypeEnum,
    start: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 3),
    len: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 5),
    lang: (buf: Uint8Array, offset: number) => (buf[offset + 7]) as LangCodeEnum,
    edgeType: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 8),
}

export const createSortHeader = (header: SortHeader): Uint8Array => {
  const buffer = new Uint8Array(SortHeaderByteSize)
  writeSortHeader(buffer, header, 0)
  return buffer
}

export const pushSortHeader = (
  buf: AutoSizedUint8Array,
  header: SortHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.order))
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.propType))
  buf.pushU16(Number(header.start))
  buf.pushU16(Number(header.len))
  buf.pushU8(Number(header.lang))
  buf.pushU16(Number(header.edgeType))
  return index
}

export const QUERY_ITERATOR_DEFAULT = 0
export const QUERY_ITERATOR_EDGE = 20
export const QUERY_ITERATOR_EDGE_INCLUDE = 30
export const QUERY_ITERATOR_SEARCH = 120
export const QUERY_ITERATOR_SEARCH_VEC = 130
export const QueryIteratorType = {
  default: 0,
  sort: 1,
  filter: 2,
  filterSort: 3,
  desc: 4,
  descSort: 5,
  descFilter: 6,
  descFilterSort: 7,
  edge: 20,
  edgeSort: 21,
  edgeFilter: 22,
  edgeFilterSort: 23,
  edgeDesc: 24,
  edgeDescSort: 25,
  edgeDescFilter: 26,
  edgeDescFilterSort: 27,
  edgeInclude: 30,
  edgeIncludeSort: 31,
  edgeIncludeFilter: 32,
  edgeIncludeFilterSort: 33,
  edgeIncludeDesc: 34,
  edgeIncludeDescSort: 35,
  edgeIncludeDescFilter: 36,
  edgeIncludeDescFilterSort: 37,
  search: 120,
  searchFilter: 121,
  vec: 130,
  vecFilter: 131,
} as const

export const QueryIteratorTypeInverse = {
  0: 'default',
  1: 'sort',
  2: 'filter',
  3: 'filterSort',
  4: 'desc',
  5: 'descSort',
  6: 'descFilter',
  7: 'descFilterSort',
  20: 'edge',
  21: 'edgeSort',
  22: 'edgeFilter',
  23: 'edgeFilterSort',
  24: 'edgeDesc',
  25: 'edgeDescSort',
  26: 'edgeDescFilter',
  27: 'edgeDescFilterSort',
  30: 'edgeInclude',
  31: 'edgeIncludeSort',
  32: 'edgeIncludeFilter',
  33: 'edgeIncludeFilterSort',
  34: 'edgeIncludeDesc',
  35: 'edgeIncludeDescSort',
  36: 'edgeIncludeDescFilter',
  37: 'edgeIncludeDescFilterSort',
  120: 'search',
  121: 'searchFilter',
  130: 'vec',
  131: 'vecFilter',
} as const

/**
  default, 
  sort, 
  filter, 
  filterSort, 
  desc, 
  descSort, 
  descFilter, 
  descFilterSort, 
  edge, 
  edgeSort, 
  edgeFilter, 
  edgeFilterSort, 
  edgeDesc, 
  edgeDescSort, 
  edgeDescFilter, 
  edgeDescFilterSort, 
  edgeInclude, 
  edgeIncludeSort, 
  edgeIncludeFilter, 
  edgeIncludeFilterSort, 
  edgeIncludeDesc, 
  edgeIncludeDescSort, 
  edgeIncludeDescFilter, 
  edgeIncludeDescFilterSort, 
  search, 
  searchFilter, 
  vec, 
  vecFilter 
 */
export type QueryIteratorTypeEnum = (typeof QueryIteratorType)[keyof typeof QueryIteratorType]

export const QueryType = {
  id: 0,
  ids: 1,
  default: 2,
  alias: 3,
  aggregates: 4,
  aggregatesCount: 5,
  references: 6,
  reference: 7,
  aliasFilter: 8,
  idFilter: 9,
  referenceEdge: 10,
} as const

export const QueryTypeInverse = {
  0: 'id',
  1: 'ids',
  2: 'default',
  3: 'alias',
  4: 'aggregates',
  5: 'aggregatesCount',
  6: 'references',
  7: 'reference',
  8: 'aliasFilter',
  9: 'idFilter',
  10: 'referenceEdge',
} as const

/**
  id, 
  ids, 
  default, 
  alias, 
  aggregates, 
  aggregatesCount, 
  references, 
  reference, 
  aliasFilter, 
  idFilter, 
  referenceEdge 
 */
export type QueryTypeEnum = (typeof QueryType)[keyof typeof QueryType]

export const IncludeOp = {
  aggregates: 4,
  aggregatesCount: 5,
  references: 6,
  reference: 7,
  referenceEdge: 10,
  default: 127,
  referencesAggregation: 128,
  meta: 129,
  partial: 130,
  defaultWithOpts: 131,
  metaWithOpts: 132,
} as const

export const IncludeOpInverse = {
  4: 'aggregates',
  5: 'aggregatesCount',
  6: 'references',
  7: 'reference',
  10: 'referenceEdge',
  127: 'default',
  128: 'referencesAggregation',
  129: 'meta',
  130: 'partial',
  131: 'defaultWithOpts',
  132: 'metaWithOpts',
} as const

/**
  aggregates, 
  aggregatesCount, 
  references, 
  reference, 
  referenceEdge, 
  default, 
  referencesAggregation, 
  meta, 
  partial, 
  defaultWithOpts, 
  metaWithOpts 
 */
export type IncludeOpEnum = (typeof IncludeOp)[keyof typeof IncludeOp]

export type IncludeHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
}

export const IncludeHeaderByteSize = 3

export const IncludeHeaderAlignOf = 4

export const packIncludeHeader = (obj: IncludeHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.propType) & 255n) << 16n
  return val
}

export const unpackIncludeHeader = (val: bigint): IncludeHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as IncludeOpEnum,
    prop: Number((val >> 8n) & 255n),
    propType: (Number((val >> 16n) & 255n)) as PropTypeEnum,
  }
}

export const writeIncludeHeader = (
  buf: Uint8Array,
  header: IncludeHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  return offset
}

export const writeIncludeHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = Number(value)
  },
}

export const readIncludeHeader = (
  buf: Uint8Array,
  offset: number,
): IncludeHeader => {
  const value: IncludeHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
  }
  return value
}

export const readIncludeHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as IncludeOpEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 2]) as PropTypeEnum,
}

export const createIncludeHeader = (header: IncludeHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludeHeaderByteSize)
  writeIncludeHeader(buffer, header, 0)
  return buffer
}

export const pushIncludeHeader = (
  buf: AutoSizedUint8Array,
  header: IncludeHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.propType))
  return index
}

export type IncludeMetaHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
}

export const IncludeMetaHeaderByteSize = 3

export const IncludeMetaHeaderAlignOf = 4

export const packIncludeMetaHeader = (obj: IncludeMetaHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.propType) & 255n) << 16n
  return val
}

export const unpackIncludeMetaHeader = (val: bigint): IncludeMetaHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as IncludeOpEnum,
    prop: Number((val >> 8n) & 255n),
    propType: (Number((val >> 16n) & 255n)) as PropTypeEnum,
  }
}

export const writeIncludeMetaHeader = (
  buf: Uint8Array,
  header: IncludeMetaHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  return offset
}

export const writeIncludeMetaHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = Number(value)
  },
}

export const readIncludeMetaHeader = (
  buf: Uint8Array,
  offset: number,
): IncludeMetaHeader => {
  const value: IncludeMetaHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
  }
  return value
}

export const readIncludeMetaHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as IncludeOpEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 2]) as PropTypeEnum,
}

export const createIncludeMetaHeader = (header: IncludeMetaHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludeMetaHeaderByteSize)
  writeIncludeMetaHeader(buffer, header, 0)
  return buffer
}

export const pushIncludeMetaHeader = (
  buf: AutoSizedUint8Array,
  header: IncludeMetaHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.propType))
  return index
}

export type IncludePartialHeader = {
  op: IncludeOpEnum
  prop: number
  propType: PropTypeEnum
  amount: number
}

export const IncludePartialHeaderByteSize = 5

export const IncludePartialHeaderAlignOf = 8

export const packIncludePartialHeader = (obj: IncludePartialHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.propType) & 255n) << 16n
  val |= (BigInt(obj.amount) & 65535n) << 24n
  return val
}

export const unpackIncludePartialHeader = (val: bigint): IncludePartialHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as IncludeOpEnum,
    prop: Number((val >> 8n) & 255n),
    propType: (Number((val >> 16n) & 255n)) as PropTypeEnum,
    amount: Number((val >> 24n) & 65535n),
  }
}

export const writeIncludePartialHeader = (
  buf: Uint8Array,
  header: IncludePartialHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  writeUint16(buf, Number(header.amount), offset)
  offset += 2
  return offset
}

export const writeIncludePartialHeaderProps = {
  op: (buf: Uint8Array, value: IncludeOpEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 2] = Number(value)
  },
  amount: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 3)
  },
}

export const readIncludePartialHeader = (
  buf: Uint8Array,
  offset: number,
): IncludePartialHeader => {
  const value: IncludePartialHeader = {
    op: (buf[offset]) as IncludeOpEnum,
    prop: buf[offset + 1],
    propType: (buf[offset + 2]) as PropTypeEnum,
    amount: readUint16(buf, offset + 3),
  }
  return value
}

export const readIncludePartialHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as IncludeOpEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 2]) as PropTypeEnum,
    amount: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 3),
}

export const createIncludePartialHeader = (header: IncludePartialHeader): Uint8Array => {
  const buffer = new Uint8Array(IncludePartialHeaderByteSize)
  writeIncludePartialHeader(buffer, header, 0)
  return buffer
}

export const pushIncludePartialHeader = (
  buf: AutoSizedUint8Array,
  header: IncludePartialHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.propType))
  buf.pushU16(Number(header.amount))
  return index
}

export type IncludePartialProp = {
  start: number
  size: number
}

export const IncludePartialPropByteSize = 4

export const IncludePartialPropAlignOf = 4

export const packIncludePartialProp = (obj: IncludePartialProp): bigint => {
  let val = 0n
  val |= (BigInt(obj.start) & 65535n) << 0n
  val |= (BigInt(obj.size) & 65535n) << 16n
  return val
}

export const unpackIncludePartialProp = (val: bigint): IncludePartialProp => {
  return {
    start: Number((val >> 0n) & 65535n),
    size: Number((val >> 16n) & 65535n),
  }
}

export const writeIncludePartialProp = (
  buf: Uint8Array,
  header: IncludePartialProp,
  offset: number,
): number => {
  writeUint16(buf, Number(header.start), offset)
  offset += 2
  writeUint16(buf, Number(header.size), offset)
  offset += 2
  return offset
}

export const writeIncludePartialPropProps = {
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 2)
  },
}

export const readIncludePartialProp = (
  buf: Uint8Array,
  offset: number,
): IncludePartialProp => {
  const value: IncludePartialProp = {
    start: readUint16(buf, offset),
    size: readUint16(buf, offset + 2),
  }
  return value
}

export const readIncludePartialPropProps = {
    start: (buf: Uint8Array, offset: number) => readUint16(buf, offset),
    size: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 2),
}

export const createIncludePartialProp = (header: IncludePartialProp): Uint8Array => {
  const buffer = new Uint8Array(IncludePartialPropByteSize)
  writeIncludePartialProp(buffer, header, 0)
  return buffer
}

export const pushIncludePartialProp = (
  buf: AutoSizedUint8Array,
  header: IncludePartialProp,
): number => {
  const index = buf.length
  buf.pushU16(Number(header.start))
  buf.pushU16(Number(header.size))
  return index
}

export type IncludeOpts = {
  end: number
  isChars: boolean
  hasOpts: boolean
  langFallbackSize: number
  lang: LangCodeEnum
}

export const IncludeOptsByteSize = 7

export const IncludeOptsAlignOf = 8

export const packIncludeOpts = (obj: IncludeOpts): bigint => {
  let val = 0n
  val |= (BigInt(obj.end) & 4294967295n) << 0n
  val |= ((obj.isChars ? 1n : 0n) & 1n) << 32n
  val |= ((obj.hasOpts ? 1n : 0n) & 1n) << 33n
  val |= (BigInt(obj.langFallbackSize) & 255n) << 40n
  val |= (BigInt(obj.lang) & 255n) << 48n
  return val
}

export const unpackIncludeOpts = (val: bigint): IncludeOpts => {
  return {
    end: Number((val >> 0n) & 4294967295n),
    isChars: ((val >> 32n) & 1n) === 1n,
    hasOpts: ((val >> 33n) & 1n) === 1n,
    langFallbackSize: Number((val >> 40n) & 255n),
    lang: (Number((val >> 48n) & 255n)) as LangCodeEnum,
  }
}

export const writeIncludeOpts = (
  buf: Uint8Array,
  header: IncludeOpts,
  offset: number,
): number => {
  writeUint32(buf, Number(header.end), offset)
  offset += 4
  buf[offset] = 0
  buf[offset] |= (((header.isChars ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= (((header.hasOpts ? 1 : 0) >>> 0) & 1) << 1
  buf[offset] |= ((0 >>> 0) & 63) << 2
  offset += 1
  buf[offset] = Number(header.langFallbackSize)
  offset += 1
  buf[offset] = Number(header.lang)
  offset += 1
  return offset
}

export const writeIncludeOptsProps = {
  end: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  isChars: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  hasOpts: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 4] |= (((value ? 1 : 0) >>> 0) & 1) << 1
  },
  langFallbackSize: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 5] = Number(value)
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 6] = Number(value)
  },
}

export const readIncludeOpts = (
  buf: Uint8Array,
  offset: number,
): IncludeOpts => {
  const value: IncludeOpts = {
    end: readUint32(buf, offset),
    isChars: (((buf[offset + 4] >>> 0) & 1)) === 1,
    hasOpts: (((buf[offset + 4] >>> 1) & 1)) === 1,
    langFallbackSize: buf[offset + 5],
    lang: (buf[offset + 6]) as LangCodeEnum,
  }
  return value
}

export const readIncludeOptsProps = {
    end: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    isChars: (buf: Uint8Array, offset: number) => (((buf[offset + 4] >>> 0) & 1)) === 1,
    hasOpts: (buf: Uint8Array, offset: number) => (((buf[offset + 4] >>> 1) & 1)) === 1,
    langFallbackSize: (buf: Uint8Array, offset: number) => buf[offset + 5],
    lang: (buf: Uint8Array, offset: number) => (buf[offset + 6]) as LangCodeEnum,
}

export const createIncludeOpts = (header: IncludeOpts): Uint8Array => {
  const buffer = new Uint8Array(IncludeOptsByteSize)
  writeIncludeOpts(buffer, header, 0)
  return buffer
}

export const pushIncludeOpts = (
  buf: AutoSizedUint8Array,
  header: IncludeOpts,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.end))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.isChars ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= (((header.hasOpts ? 1 : 0) >>> 0) & 1) << 1
  buf.view[buf.length - 1] |= ((0 >>> 0) & 63) << 2
  buf.pushU8(Number(header.langFallbackSize))
  buf.pushU8(Number(header.lang))
  return index
}

export type IncludeResponse = {
  prop: number
  size: number
}

export const IncludeResponseByteSize = 5

export const IncludeResponseAlignOf = 8

export const packIncludeResponse = (obj: IncludeResponse): bigint => {
  let val = 0n
  val |= (BigInt(obj.prop) & 255n) << 0n
  val |= (BigInt(obj.size) & 4294967295n) << 8n
  return val
}

export const unpackIncludeResponse = (val: bigint): IncludeResponse => {
  return {
    prop: Number((val >> 0n) & 255n),
    size: Number((val >> 8n) & 4294967295n),
  }
}

export const writeIncludeResponse = (
  buf: Uint8Array,
  header: IncludeResponse,
  offset: number,
): number => {
  buf[offset] = Number(header.prop)
  offset += 1
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeIncludeResponseProps = {
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 1)
  },
}

export const readIncludeResponse = (
  buf: Uint8Array,
  offset: number,
): IncludeResponse => {
  const value: IncludeResponse = {
    prop: buf[offset],
    size: readUint32(buf, offset + 1),
  }
  return value
}

export const readIncludeResponseProps = {
    prop: (buf: Uint8Array, offset: number) => buf[offset],
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 1),
}

export const createIncludeResponse = (header: IncludeResponse): Uint8Array => {
  const buffer = new Uint8Array(IncludeResponseByteSize)
  writeIncludeResponse(buffer, header, 0)
  return buffer
}

export const pushIncludeResponse = (
  buf: AutoSizedUint8Array,
  header: IncludeResponse,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.prop))
  buf.pushU32(Number(header.size))
  return index
}

export type IncludeResponseMeta = {
  op: ReadOpEnum
  prop: number
  lang: LangCodeEnum
  compressed: boolean
  crc32: number
  size: number
}

export const IncludeResponseMetaByteSize = 12

export const IncludeResponseMetaAlignOf = 16

export const packIncludeResponseMeta = (obj: IncludeResponseMeta): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.lang) & 255n) << 16n
  val |= ((obj.compressed ? 1n : 0n) & 1n) << 24n
  val |= (BigInt(obj.crc32) & 4294967295n) << 32n
  val |= (BigInt(obj.size) & 4294967295n) << 64n
  return val
}

export const unpackIncludeResponseMeta = (val: bigint): IncludeResponseMeta => {
  return {
    op: (Number((val >> 0n) & 255n)) as ReadOpEnum,
    prop: Number((val >> 8n) & 255n),
    lang: (Number((val >> 16n) & 255n)) as LangCodeEnum,
    compressed: ((val >> 24n) & 1n) === 1n,
    crc32: Number((val >> 32n) & 4294967295n),
    size: Number((val >> 64n) & 4294967295n),
  }
}

export const writeIncludeResponseMeta = (
  buf: Uint8Array,
  header: IncludeResponseMeta,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.lang)
  offset += 1
  buf[offset] = 0
  buf[offset] |= (((header.compressed ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  writeUint32(buf, Number(header.crc32), offset)
  offset += 4
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  return offset
}

export const writeIncludeResponseMetaProps = {
  op: (buf: Uint8Array, value: ReadOpEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  lang: (buf: Uint8Array, value: LangCodeEnum, offset: number) => {
    buf[offset + 2] = Number(value)
  },
  compressed: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 3] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  crc32: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 4)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 8)
  },
}

export const readIncludeResponseMeta = (
  buf: Uint8Array,
  offset: number,
): IncludeResponseMeta => {
  const value: IncludeResponseMeta = {
    op: (buf[offset]) as ReadOpEnum,
    prop: buf[offset + 1],
    lang: (buf[offset + 2]) as LangCodeEnum,
    compressed: (((buf[offset + 3] >>> 0) & 1)) === 1,
    crc32: readUint32(buf, offset + 4),
    size: readUint32(buf, offset + 8),
  }
  return value
}

export const readIncludeResponseMetaProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as ReadOpEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    lang: (buf: Uint8Array, offset: number) => (buf[offset + 2]) as LangCodeEnum,
    compressed: (buf: Uint8Array, offset: number) => (((buf[offset + 3] >>> 0) & 1)) === 1,
    crc32: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 4),
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 8),
}

export const createIncludeResponseMeta = (header: IncludeResponseMeta): Uint8Array => {
  const buffer = new Uint8Array(IncludeResponseMetaByteSize)
  writeIncludeResponseMeta(buffer, header, 0)
  return buffer
}

export const pushIncludeResponseMeta = (
  buf: AutoSizedUint8Array,
  header: IncludeResponseMeta,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.lang))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.compressed ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= ((0 >>> 0) & 127) << 1
  buf.pushU32(Number(header.crc32))
  buf.pushU32(Number(header.size))
  return index
}

export type SubscriptionHeader = {
  op: OpTypeEnum
  typeId: TypeId
  fieldsLen: number
  partialLen: number
}

export const SubscriptionHeaderByteSize = 5

export const SubscriptionHeaderAlignOf = 8

export const packSubscriptionHeader = (obj: SubscriptionHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.typeId) & 65535n) << 8n
  val |= (BigInt(obj.fieldsLen) & 255n) << 24n
  val |= (BigInt(obj.partialLen) & 255n) << 32n
  return val
}

export const unpackSubscriptionHeader = (val: bigint): SubscriptionHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as OpTypeEnum,
    typeId: (Number((val >> 8n) & 65535n)) as TypeId,
    fieldsLen: Number((val >> 24n) & 255n),
    partialLen: Number((val >> 32n) & 255n),
  }
}

export const writeSubscriptionHeader = (
  buf: Uint8Array,
  header: SubscriptionHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  buf[offset] = Number(header.fieldsLen)
  offset += 1
  buf[offset] = Number(header.partialLen)
  offset += 1
  return offset
}

export const writeSubscriptionHeaderProps = {
  op: (buf: Uint8Array, value: OpTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 1)
  },
  fieldsLen: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 3] = Number(value)
  },
  partialLen: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 4] = Number(value)
  },
}

export const readSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): SubscriptionHeader => {
  const value: SubscriptionHeader = {
    op: (buf[offset]) as OpTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    fieldsLen: buf[offset + 3],
    partialLen: buf[offset + 4],
  }
  return value
}

export const readSubscriptionHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as OpTypeEnum,
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 1)) as TypeId,
    fieldsLen: (buf: Uint8Array, offset: number) => buf[offset + 3],
    partialLen: (buf: Uint8Array, offset: number) => buf[offset + 4],
}

export const createSubscriptionHeader = (header: SubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(SubscriptionHeaderByteSize)
  writeSubscriptionHeader(buffer, header, 0)
  return buffer
}

export const pushSubscriptionHeader = (
  buf: AutoSizedUint8Array,
  header: SubscriptionHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU16(Number(header.typeId))
  buf.pushU8(Number(header.fieldsLen))
  buf.pushU8(Number(header.partialLen))
  return index
}

export type QueryHeader = {
  op: QueryTypeEnum
  prop: number
  typeId: TypeId
  edgeTypeId: TypeId
  offset: number
  limit: number
  filterSize: number
  searchSize: number
  edgeSize: number
  edgeFilterSize: number
  includeSize: number
  iteratorType: QueryIteratorTypeEnum
  size: number
  sort: boolean
}

export const QueryHeaderByteSize = 28

export const QueryHeaderAlignOf = 16

export const packQueryHeader = (obj: QueryHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.typeId) & 65535n) << 16n
  val |= (BigInt(obj.edgeTypeId) & 65535n) << 32n
  val |= (BigInt(obj.offset) & 4294967295n) << 48n
  val |= (BigInt(obj.limit) & 4294967295n) << 80n
  val |= (BigInt(obj.filterSize) & 65535n) << 112n
  val |= (BigInt(obj.searchSize) & 65535n) << 128n
  val |= (BigInt(obj.edgeSize) & 65535n) << 144n
  val |= (BigInt(obj.edgeFilterSize) & 65535n) << 160n
  val |= (BigInt(obj.includeSize) & 65535n) << 176n
  val |= (BigInt(obj.iteratorType) & 255n) << 192n
  val |= (BigInt(obj.size) & 65535n) << 200n
  val |= ((obj.sort ? 1n : 0n) & 1n) << 216n
  return val
}

export const unpackQueryHeader = (val: bigint): QueryHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as QueryTypeEnum,
    prop: Number((val >> 8n) & 255n),
    typeId: (Number((val >> 16n) & 65535n)) as TypeId,
    edgeTypeId: (Number((val >> 32n) & 65535n)) as TypeId,
    offset: Number((val >> 48n) & 4294967295n),
    limit: Number((val >> 80n) & 4294967295n),
    filterSize: Number((val >> 112n) & 65535n),
    searchSize: Number((val >> 128n) & 65535n),
    edgeSize: Number((val >> 144n) & 65535n),
    edgeFilterSize: Number((val >> 160n) & 65535n),
    includeSize: Number((val >> 176n) & 65535n),
    iteratorType: (Number((val >> 192n) & 255n)) as QueryIteratorTypeEnum,
    size: Number((val >> 200n) & 65535n),
    sort: ((val >> 216n) & 1n) === 1n,
  }
}

export const writeQueryHeader = (
  buf: Uint8Array,
  header: QueryHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  writeUint16(buf, Number(header.edgeTypeId), offset)
  offset += 2
  writeUint32(buf, Number(header.offset), offset)
  offset += 4
  writeUint32(buf, Number(header.limit), offset)
  offset += 4
  writeUint16(buf, Number(header.filterSize), offset)
  offset += 2
  writeUint16(buf, Number(header.searchSize), offset)
  offset += 2
  writeUint16(buf, Number(header.edgeSize), offset)
  offset += 2
  writeUint16(buf, Number(header.edgeFilterSize), offset)
  offset += 2
  writeUint16(buf, Number(header.includeSize), offset)
  offset += 2
  buf[offset] = Number(header.iteratorType)
  offset += 1
  writeUint16(buf, Number(header.size), offset)
  offset += 2
  buf[offset] = 0
  buf[offset] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= ((0 >>> 0) & 127) << 1
  offset += 1
  return offset
}

export const writeQueryHeaderProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 2)
  },
  edgeTypeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 4)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 6)
  },
  limit: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 10)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 14)
  },
  searchSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 16)
  },
  edgeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 18)
  },
  edgeFilterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 20)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 22)
  },
  iteratorType: (buf: Uint8Array, value: QueryIteratorTypeEnum, offset: number) => {
    buf[offset + 24] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 25)
  },
  sort: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 27] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
}

export const readQueryHeader = (
  buf: Uint8Array,
  offset: number,
): QueryHeader => {
  const value: QueryHeader = {
    op: (buf[offset]) as QueryTypeEnum,
    prop: buf[offset + 1],
    typeId: (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (readUint16(buf, offset + 4)) as TypeId,
    offset: readUint32(buf, offset + 6),
    limit: readUint32(buf, offset + 10),
    filterSize: readUint16(buf, offset + 14),
    searchSize: readUint16(buf, offset + 16),
    edgeSize: readUint16(buf, offset + 18),
    edgeFilterSize: readUint16(buf, offset + 20),
    includeSize: readUint16(buf, offset + 22),
    iteratorType: (buf[offset + 24]) as QueryIteratorTypeEnum,
    size: readUint16(buf, offset + 25),
    sort: (((buf[offset + 27] >>> 0) & 1)) === 1,
  }
  return value
}

export const readQueryHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as QueryTypeEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 4)) as TypeId,
    offset: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 6),
    limit: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 10),
    filterSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 14),
    searchSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 16),
    edgeSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 18),
    edgeFilterSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 20),
    includeSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 22),
    iteratorType: (buf: Uint8Array, offset: number) => (buf[offset + 24]) as QueryIteratorTypeEnum,
    size: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 25),
    sort: (buf: Uint8Array, offset: number) => (((buf[offset + 27] >>> 0) & 1)) === 1,
}

export const createQueryHeader = (header: QueryHeader): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderByteSize)
  writeQueryHeader(buffer, header, 0)
  return buffer
}

export const pushQueryHeader = (
  buf: AutoSizedUint8Array,
  header: QueryHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU16(Number(header.typeId))
  buf.pushU16(Number(header.edgeTypeId))
  buf.pushU32(Number(header.offset))
  buf.pushU32(Number(header.limit))
  buf.pushU16(Number(header.filterSize))
  buf.pushU16(Number(header.searchSize))
  buf.pushU16(Number(header.edgeSize))
  buf.pushU16(Number(header.edgeFilterSize))
  buf.pushU16(Number(header.includeSize))
  buf.pushU8(Number(header.iteratorType))
  buf.pushU16(Number(header.size))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= ((0 >>> 0) & 127) << 1
  return index
}

export type QueryHeaderSingle = {
  op: QueryTypeEnum
  typeId: TypeId
  prop: number
  id: number
  filterSize: number
  includeSize: number
  aliasSize: number
}

export const QueryHeaderSingleByteSize = 14

export const QueryHeaderSingleAlignOf = 16

export const packQueryHeaderSingle = (obj: QueryHeaderSingle): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.typeId) & 65535n) << 8n
  val |= (BigInt(obj.prop) & 255n) << 24n
  val |= (BigInt(obj.id) & 4294967295n) << 32n
  val |= (BigInt(obj.filterSize) & 65535n) << 64n
  val |= (BigInt(obj.includeSize) & 65535n) << 80n
  val |= (BigInt(obj.aliasSize) & 65535n) << 96n
  return val
}

export const unpackQueryHeaderSingle = (val: bigint): QueryHeaderSingle => {
  return {
    op: (Number((val >> 0n) & 255n)) as QueryTypeEnum,
    typeId: (Number((val >> 8n) & 65535n)) as TypeId,
    prop: Number((val >> 24n) & 255n),
    id: Number((val >> 32n) & 4294967295n),
    filterSize: Number((val >> 64n) & 65535n),
    includeSize: Number((val >> 80n) & 65535n),
    aliasSize: Number((val >> 96n) & 65535n),
  }
}

export const writeQueryHeaderSingle = (
  buf: Uint8Array,
  header: QueryHeaderSingle,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  buf[offset] = Number(header.prop)
  offset += 1
  writeUint32(buf, Number(header.id), offset)
  offset += 4
  writeUint16(buf, Number(header.filterSize), offset)
  offset += 2
  writeUint16(buf, Number(header.includeSize), offset)
  offset += 2
  writeUint16(buf, Number(header.aliasSize), offset)
  offset += 2
  return offset
}

export const writeQueryHeaderSingleProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 1)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 3] = Number(value)
  },
  id: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 4)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 8)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 10)
  },
  aliasSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 12)
  },
}

export const readQueryHeaderSingle = (
  buf: Uint8Array,
  offset: number,
): QueryHeaderSingle => {
  const value: QueryHeaderSingle = {
    op: (buf[offset]) as QueryTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    prop: buf[offset + 3],
    id: readUint32(buf, offset + 4),
    filterSize: readUint16(buf, offset + 8),
    includeSize: readUint16(buf, offset + 10),
    aliasSize: readUint16(buf, offset + 12),
  }
  return value
}

export const readQueryHeaderSingleProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as QueryTypeEnum,
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 1)) as TypeId,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 3],
    id: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 4),
    filterSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 8),
    includeSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 10),
    aliasSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 12),
}

export const createQueryHeaderSingle = (header: QueryHeaderSingle): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderSingleByteSize)
  writeQueryHeaderSingle(buffer, header, 0)
  return buffer
}

export const pushQueryHeaderSingle = (
  buf: AutoSizedUint8Array,
  header: QueryHeaderSingle,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU16(Number(header.typeId))
  buf.pushU8(Number(header.prop))
  buf.pushU32(Number(header.id))
  buf.pushU16(Number(header.filterSize))
  buf.pushU16(Number(header.includeSize))
  buf.pushU16(Number(header.aliasSize))
  return index
}

export type QueryHeaderSingleReference = {
  op: QueryTypeEnum
  prop: number
  typeId: TypeId
  edgeTypeId: TypeId
  edgeSize: number
  includeSize: number
}

export const QueryHeaderSingleReferenceByteSize = 10

export const QueryHeaderSingleReferenceAlignOf = 16

export const packQueryHeaderSingleReference = (obj: QueryHeaderSingleReference): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.prop) & 255n) << 8n
  val |= (BigInt(obj.typeId) & 65535n) << 16n
  val |= (BigInt(obj.edgeTypeId) & 65535n) << 32n
  val |= (BigInt(obj.edgeSize) & 65535n) << 48n
  val |= (BigInt(obj.includeSize) & 65535n) << 64n
  return val
}

export const unpackQueryHeaderSingleReference = (val: bigint): QueryHeaderSingleReference => {
  return {
    op: (Number((val >> 0n) & 255n)) as QueryTypeEnum,
    prop: Number((val >> 8n) & 255n),
    typeId: (Number((val >> 16n) & 65535n)) as TypeId,
    edgeTypeId: (Number((val >> 32n) & 65535n)) as TypeId,
    edgeSize: Number((val >> 48n) & 65535n),
    includeSize: Number((val >> 64n) & 65535n),
  }
}

export const writeQueryHeaderSingleReference = (
  buf: Uint8Array,
  header: QueryHeaderSingleReference,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  buf[offset] = Number(header.prop)
  offset += 1
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  writeUint16(buf, Number(header.edgeTypeId), offset)
  offset += 2
  writeUint16(buf, Number(header.edgeSize), offset)
  offset += 2
  writeUint16(buf, Number(header.includeSize), offset)
  offset += 2
  return offset
}

export const writeQueryHeaderSingleReferenceProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 2)
  },
  edgeTypeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 4)
  },
  edgeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 6)
  },
  includeSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 8)
  },
}

export const readQueryHeaderSingleReference = (
  buf: Uint8Array,
  offset: number,
): QueryHeaderSingleReference => {
  const value: QueryHeaderSingleReference = {
    op: (buf[offset]) as QueryTypeEnum,
    prop: buf[offset + 1],
    typeId: (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (readUint16(buf, offset + 4)) as TypeId,
    edgeSize: readUint16(buf, offset + 6),
    includeSize: readUint16(buf, offset + 8),
  }
  return value
}

export const readQueryHeaderSingleReferenceProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as QueryTypeEnum,
    prop: (buf: Uint8Array, offset: number) => buf[offset + 1],
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 2)) as TypeId,
    edgeTypeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 4)) as TypeId,
    edgeSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 6),
    includeSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 8),
}

export const createQueryHeaderSingleReference = (header: QueryHeaderSingleReference): Uint8Array => {
  const buffer = new Uint8Array(QueryHeaderSingleReferenceByteSize)
  writeQueryHeaderSingleReference(buffer, header, 0)
  return buffer
}

export const pushQueryHeaderSingleReference = (
  buf: AutoSizedUint8Array,
  header: QueryHeaderSingleReference,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU8(Number(header.prop))
  buf.pushU16(Number(header.typeId))
  buf.pushU16(Number(header.edgeTypeId))
  buf.pushU16(Number(header.edgeSize))
  buf.pushU16(Number(header.includeSize))
  return index
}

export const VectorBaseType = {
  int8: 1,
  uint8: 2,
  int16: 3,
  uint16: 4,
  int32: 5,
  uint32: 6,
  float32: 7,
  float64: 8,
} as const

export const VectorBaseTypeInverse = {
  1: 'int8',
  2: 'uint8',
  3: 'int16',
  4: 'uint16',
  5: 'int32',
  6: 'uint32',
  7: 'float32',
  8: 'float64',
} as const

/**
  int8, 
  uint8, 
  int16, 
  uint16, 
  int32, 
  uint32, 
  float32, 
  float64 
 */
export type VectorBaseTypeEnum = (typeof VectorBaseType)[keyof typeof VectorBaseType]

export type AggHeader = {
  op: QueryTypeEnum
  typeId: TypeId
  offset: number
  limit: number
  filterSize: number
  iteratorType: QueryIteratorTypeEnum
  size: number
  resultsSize: number
  accumulatorSize: number
  sort: boolean
  hasGroupBy: boolean
  isSamplingSet: boolean
}

export const AggHeaderByteSize = 21

export const AggHeaderAlignOf = 16

export const packAggHeader = (obj: AggHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.op) & 255n) << 0n
  val |= (BigInt(obj.typeId) & 65535n) << 8n
  val |= (BigInt(obj.offset) & 4294967295n) << 24n
  val |= (BigInt(obj.limit) & 4294967295n) << 56n
  val |= (BigInt(obj.filterSize) & 65535n) << 88n
  val |= (BigInt(obj.iteratorType) & 255n) << 104n
  val |= (BigInt(obj.size) & 65535n) << 112n
  val |= (BigInt(obj.resultsSize) & 65535n) << 128n
  val |= (BigInt(obj.accumulatorSize) & 65535n) << 144n
  val |= ((obj.sort ? 1n : 0n) & 1n) << 160n
  val |= ((obj.hasGroupBy ? 1n : 0n) & 1n) << 161n
  val |= ((obj.isSamplingSet ? 1n : 0n) & 1n) << 162n
  return val
}

export const unpackAggHeader = (val: bigint): AggHeader => {
  return {
    op: (Number((val >> 0n) & 255n)) as QueryTypeEnum,
    typeId: (Number((val >> 8n) & 65535n)) as TypeId,
    offset: Number((val >> 24n) & 4294967295n),
    limit: Number((val >> 56n) & 4294967295n),
    filterSize: Number((val >> 88n) & 65535n),
    iteratorType: (Number((val >> 104n) & 255n)) as QueryIteratorTypeEnum,
    size: Number((val >> 112n) & 65535n),
    resultsSize: Number((val >> 128n) & 65535n),
    accumulatorSize: Number((val >> 144n) & 65535n),
    sort: ((val >> 160n) & 1n) === 1n,
    hasGroupBy: ((val >> 161n) & 1n) === 1n,
    isSamplingSet: ((val >> 162n) & 1n) === 1n,
  }
}

export const writeAggHeader = (
  buf: Uint8Array,
  header: AggHeader,
  offset: number,
): number => {
  buf[offset] = Number(header.op)
  offset += 1
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  writeUint32(buf, Number(header.offset), offset)
  offset += 4
  writeUint32(buf, Number(header.limit), offset)
  offset += 4
  writeUint16(buf, Number(header.filterSize), offset)
  offset += 2
  buf[offset] = Number(header.iteratorType)
  offset += 1
  writeUint16(buf, Number(header.size), offset)
  offset += 2
  writeUint16(buf, Number(header.resultsSize), offset)
  offset += 2
  writeUint16(buf, Number(header.accumulatorSize), offset)
  offset += 2
  buf[offset] = 0
  buf[offset] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf[offset] |= (((header.hasGroupBy ? 1 : 0) >>> 0) & 1) << 1
  buf[offset] |= (((header.isSamplingSet ? 1 : 0) >>> 0) & 1) << 2
  buf[offset] |= ((0 >>> 0) & 31) << 3
  offset += 1
  return offset
}

export const writeAggHeaderProps = {
  op: (buf: Uint8Array, value: QueryTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 1)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 3)
  },
  limit: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 7)
  },
  filterSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 11)
  },
  iteratorType: (buf: Uint8Array, value: QueryIteratorTypeEnum, offset: number) => {
    buf[offset + 13] = Number(value)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 14)
  },
  resultsSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 16)
  },
  accumulatorSize: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 18)
  },
  sort: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 0
  },
  hasGroupBy: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 1
  },
  isSamplingSet: (buf: Uint8Array, value: boolean, offset: number) => {
    buf[offset + 20] |= (((value ? 1 : 0) >>> 0) & 1) << 2
  },
}

export const readAggHeader = (
  buf: Uint8Array,
  offset: number,
): AggHeader => {
  const value: AggHeader = {
    op: (buf[offset]) as QueryTypeEnum,
    typeId: (readUint16(buf, offset + 1)) as TypeId,
    offset: readUint32(buf, offset + 3),
    limit: readUint32(buf, offset + 7),
    filterSize: readUint16(buf, offset + 11),
    iteratorType: (buf[offset + 13]) as QueryIteratorTypeEnum,
    size: readUint16(buf, offset + 14),
    resultsSize: readUint16(buf, offset + 16),
    accumulatorSize: readUint16(buf, offset + 18),
    sort: (((buf[offset + 20] >>> 0) & 1)) === 1,
    hasGroupBy: (((buf[offset + 20] >>> 1) & 1)) === 1,
    isSamplingSet: (((buf[offset + 20] >>> 2) & 1)) === 1,
  }
  return value
}

export const readAggHeaderProps = {
    op: (buf: Uint8Array, offset: number) => (buf[offset]) as QueryTypeEnum,
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 1)) as TypeId,
    offset: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 3),
    limit: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 7),
    filterSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 11),
    iteratorType: (buf: Uint8Array, offset: number) => (buf[offset + 13]) as QueryIteratorTypeEnum,
    size: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 14),
    resultsSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 16),
    accumulatorSize: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 18),
    sort: (buf: Uint8Array, offset: number) => (((buf[offset + 20] >>> 0) & 1)) === 1,
    hasGroupBy: (buf: Uint8Array, offset: number) => (((buf[offset + 20] >>> 1) & 1)) === 1,
    isSamplingSet: (buf: Uint8Array, offset: number) => (((buf[offset + 20] >>> 2) & 1)) === 1,
}

export const createAggHeader = (header: AggHeader): Uint8Array => {
  const buffer = new Uint8Array(AggHeaderByteSize)
  writeAggHeader(buffer, header, 0)
  return buffer
}

export const pushAggHeader = (
  buf: AutoSizedUint8Array,
  header: AggHeader,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.op))
  buf.pushU16(Number(header.typeId))
  buf.pushU32(Number(header.offset))
  buf.pushU32(Number(header.limit))
  buf.pushU16(Number(header.filterSize))
  buf.pushU8(Number(header.iteratorType))
  buf.pushU16(Number(header.size))
  buf.pushU16(Number(header.resultsSize))
  buf.pushU16(Number(header.accumulatorSize))
  buf.pushU8(0)
  buf.view[buf.length - 1] |= (((header.sort ? 1 : 0) >>> 0) & 1) << 0
  buf.view[buf.length - 1] |= (((header.hasGroupBy ? 1 : 0) >>> 0) & 1) << 1
  buf.view[buf.length - 1] |= (((header.isSamplingSet ? 1 : 0) >>> 0) & 1) << 2
  buf.view[buf.length - 1] |= ((0 >>> 0) & 31) << 3
  return index
}

export type addMultiSubscriptionHeader = {
  typeId: number
}

export const addMultiSubscriptionHeaderByteSize = 2

export const addMultiSubscriptionHeaderAlignOf = 2

export const packaddMultiSubscriptionHeader = (obj: addMultiSubscriptionHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.typeId) & 65535n) << 0n
  return val
}

export const unpackaddMultiSubscriptionHeader = (val: bigint): addMultiSubscriptionHeader => {
  return {
    typeId: Number((val >> 0n) & 65535n),
  }
}

export const writeaddMultiSubscriptionHeader = (
  buf: Uint8Array,
  header: addMultiSubscriptionHeader,
  offset: number,
): number => {
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  return offset
}

export const writeaddMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset)
  },
}

export const readaddMultiSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): addMultiSubscriptionHeader => {
  const value: addMultiSubscriptionHeader = {
    typeId: readUint16(buf, offset),
  }
  return value
}

export const readaddMultiSubscriptionHeaderProps = {
    typeId: (buf: Uint8Array, offset: number) => readUint16(buf, offset),
}

export const createaddMultiSubscriptionHeader = (header: addMultiSubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(addMultiSubscriptionHeaderByteSize)
  writeaddMultiSubscriptionHeader(buffer, header, 0)
  return buffer
}

export const pushaddMultiSubscriptionHeader = (
  buf: AutoSizedUint8Array,
  header: addMultiSubscriptionHeader,
): number => {
  const index = buf.length
  buf.pushU16(Number(header.typeId))
  return index
}

export type removeMultiSubscriptionHeader = {
  typeId: number
}

export const removeMultiSubscriptionHeaderByteSize = 2

export const removeMultiSubscriptionHeaderAlignOf = 2

export const packremoveMultiSubscriptionHeader = (obj: removeMultiSubscriptionHeader): bigint => {
  let val = 0n
  val |= (BigInt(obj.typeId) & 65535n) << 0n
  return val
}

export const unpackremoveMultiSubscriptionHeader = (val: bigint): removeMultiSubscriptionHeader => {
  return {
    typeId: Number((val >> 0n) & 65535n),
  }
}

export const writeremoveMultiSubscriptionHeader = (
  buf: Uint8Array,
  header: removeMultiSubscriptionHeader,
  offset: number,
): number => {
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  return offset
}

export const writeremoveMultiSubscriptionHeaderProps = {
  typeId: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset)
  },
}

export const readremoveMultiSubscriptionHeader = (
  buf: Uint8Array,
  offset: number,
): removeMultiSubscriptionHeader => {
  const value: removeMultiSubscriptionHeader = {
    typeId: readUint16(buf, offset),
  }
  return value
}

export const readremoveMultiSubscriptionHeaderProps = {
    typeId: (buf: Uint8Array, offset: number) => readUint16(buf, offset),
}

export const createremoveMultiSubscriptionHeader = (header: removeMultiSubscriptionHeader): Uint8Array => {
  const buffer = new Uint8Array(removeMultiSubscriptionHeaderByteSize)
  writeremoveMultiSubscriptionHeader(buffer, header, 0)
  return buffer
}

export const pushremoveMultiSubscriptionHeader = (
  buf: AutoSizedUint8Array,
  header: removeMultiSubscriptionHeader,
): number => {
  const index = buf.length
  buf.pushU16(Number(header.typeId))
  return index
}

export type AggProp = {
  propId: number
  propType: PropTypeEnum
  propDefStart: number
  aggFunction: AggFunctionEnum
  resultPos: number
  accumulatorPos: number
}

export const AggPropByteSize = 9

export const AggPropAlignOf = 16

export const packAggProp = (obj: AggProp): bigint => {
  let val = 0n
  val |= (BigInt(obj.propId) & 255n) << 0n
  val |= (BigInt(obj.propType) & 255n) << 8n
  val |= (BigInt(obj.propDefStart) & 65535n) << 16n
  val |= (BigInt(obj.aggFunction) & 255n) << 32n
  val |= (BigInt(obj.resultPos) & 65535n) << 40n
  val |= (BigInt(obj.accumulatorPos) & 65535n) << 56n
  return val
}

export const unpackAggProp = (val: bigint): AggProp => {
  return {
    propId: Number((val >> 0n) & 255n),
    propType: (Number((val >> 8n) & 255n)) as PropTypeEnum,
    propDefStart: Number((val >> 16n) & 65535n),
    aggFunction: (Number((val >> 32n) & 255n)) as AggFunctionEnum,
    resultPos: Number((val >> 40n) & 65535n),
    accumulatorPos: Number((val >> 56n) & 65535n),
  }
}

export const writeAggProp = (
  buf: Uint8Array,
  header: AggProp,
  offset: number,
): number => {
  buf[offset] = Number(header.propId)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  writeUint16(buf, Number(header.propDefStart), offset)
  offset += 2
  buf[offset] = Number(header.aggFunction)
  offset += 1
  writeUint16(buf, Number(header.resultPos), offset)
  offset += 2
  writeUint16(buf, Number(header.accumulatorPos), offset)
  offset += 2
  return offset
}

export const writeAggPropProps = {
  propId: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propDefStart: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 2)
  },
  aggFunction: (buf: Uint8Array, value: AggFunctionEnum, offset: number) => {
    buf[offset + 4] = Number(value)
  },
  resultPos: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 5)
  },
  accumulatorPos: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 7)
  },
}

export const readAggProp = (
  buf: Uint8Array,
  offset: number,
): AggProp => {
  const value: AggProp = {
    propId: buf[offset],
    propType: (buf[offset + 1]) as PropTypeEnum,
    propDefStart: readUint16(buf, offset + 2),
    aggFunction: (buf[offset + 4]) as AggFunctionEnum,
    resultPos: readUint16(buf, offset + 5),
    accumulatorPos: readUint16(buf, offset + 7),
  }
  return value
}

export const readAggPropProps = {
    propId: (buf: Uint8Array, offset: number) => buf[offset],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 1]) as PropTypeEnum,
    propDefStart: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 2),
    aggFunction: (buf: Uint8Array, offset: number) => (buf[offset + 4]) as AggFunctionEnum,
    resultPos: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 5),
    accumulatorPos: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 7),
}

export const createAggProp = (header: AggProp): Uint8Array => {
  const buffer = new Uint8Array(AggPropByteSize)
  writeAggProp(buffer, header, 0)
  return buffer
}

export const pushAggProp = (
  buf: AutoSizedUint8Array,
  header: AggProp,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.propId))
  buf.pushU8(Number(header.propType))
  buf.pushU16(Number(header.propDefStart))
  buf.pushU8(Number(header.aggFunction))
  buf.pushU16(Number(header.resultPos))
  buf.pushU16(Number(header.accumulatorPos))
  return index
}

export type GroupByKeyProp = {
  propId: number
  propType: PropTypeEnum
  propDefStart: number
  stepType: number
  stepRange: number
  timezone: number
}

export const GroupByKeyPropByteSize = 11

export const GroupByKeyPropAlignOf = 16

export const packGroupByKeyProp = (obj: GroupByKeyProp): bigint => {
  let val = 0n
  val |= (BigInt(obj.propId) & 255n) << 0n
  val |= (BigInt(obj.propType) & 255n) << 8n
  val |= (BigInt(obj.propDefStart) & 65535n) << 16n
  val |= (BigInt(obj.stepType) & 255n) << 32n
  val |= (BigInt(obj.stepRange) & 4294967295n) << 40n
  val |= (BigInt(obj.timezone) & 65535n) << 72n
  return val
}

export const unpackGroupByKeyProp = (val: bigint): GroupByKeyProp => {
  return {
    propId: Number((val >> 0n) & 255n),
    propType: (Number((val >> 8n) & 255n)) as PropTypeEnum,
    propDefStart: Number((val >> 16n) & 65535n),
    stepType: Number((val >> 32n) & 255n),
    stepRange: Number((val >> 40n) & 4294967295n),
    timezone: Number((val >> 72n) & 65535n),
  }
}

export const writeGroupByKeyProp = (
  buf: Uint8Array,
  header: GroupByKeyProp,
  offset: number,
): number => {
  buf[offset] = Number(header.propId)
  offset += 1
  buf[offset] = Number(header.propType)
  offset += 1
  writeUint16(buf, Number(header.propDefStart), offset)
  offset += 2
  buf[offset] = Number(header.stepType)
  offset += 1
  writeUint32(buf, Number(header.stepRange), offset)
  offset += 4
  writeUint16(buf, Number(header.timezone), offset)
  offset += 2
  return offset
}

export const writeGroupByKeyPropProps = {
  propId: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset] = Number(value)
  },
  propType: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset + 1] = Number(value)
  },
  propDefStart: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 2)
  },
  stepType: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 4] = Number(value)
  },
  stepRange: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 5)
  },
  timezone: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 9)
  },
}

export const readGroupByKeyProp = (
  buf: Uint8Array,
  offset: number,
): GroupByKeyProp => {
  const value: GroupByKeyProp = {
    propId: buf[offset],
    propType: (buf[offset + 1]) as PropTypeEnum,
    propDefStart: readUint16(buf, offset + 2),
    stepType: buf[offset + 4],
    stepRange: readUint32(buf, offset + 5),
    timezone: readUint16(buf, offset + 9),
  }
  return value
}

export const readGroupByKeyPropProps = {
    propId: (buf: Uint8Array, offset: number) => buf[offset],
    propType: (buf: Uint8Array, offset: number) => (buf[offset + 1]) as PropTypeEnum,
    propDefStart: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 2),
    stepType: (buf: Uint8Array, offset: number) => buf[offset + 4],
    stepRange: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 5),
    timezone: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 9),
}

export const createGroupByKeyProp = (header: GroupByKeyProp): Uint8Array => {
  const buffer = new Uint8Array(GroupByKeyPropByteSize)
  writeGroupByKeyProp(buffer, header, 0)
  return buffer
}

export const pushGroupByKeyProp = (
  buf: AutoSizedUint8Array,
  header: GroupByKeyProp,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.propId))
  buf.pushU8(Number(header.propType))
  buf.pushU16(Number(header.propDefStart))
  buf.pushU8(Number(header.stepType))
  buf.pushU32(Number(header.stepRange))
  buf.pushU16(Number(header.timezone))
  return index
}

export const FilterOpCompare = {
  eq: 4,
  neq: 5,
  eqBatch: 6,
  neqBatch: 7,
  eqBatchSmall: 8,
  neqBatchSmall: 9,
  range: 10,
  nrange: 11,
  gt: 14,
  lt: 15,
  gtBatch: 16,
  ltBatch: 17,
  gtBatchSmall: 18,
  ltBatchSmall: 19,
  ge: 20,
  le: 21,
  geBatch: 22,
  leBatch: 23,
  geBatchSmall: 24,
  leBatchSmall: 25,
  selectLargeRefs: 203,
  selectRef: 204,
  selectSmallRefs: 205,
  selectLargeRefEdge: 206,
  selectLargeRefsEdge: 207,
  nextOrIndex: 253,
} as const

export const FilterOpCompareInverse = {
  4: 'eq',
  5: 'neq',
  6: 'eqBatch',
  7: 'neqBatch',
  8: 'eqBatchSmall',
  9: 'neqBatchSmall',
  10: 'range',
  11: 'nrange',
  14: 'gt',
  15: 'lt',
  16: 'gtBatch',
  17: 'ltBatch',
  18: 'gtBatchSmall',
  19: 'ltBatchSmall',
  20: 'ge',
  21: 'le',
  22: 'geBatch',
  23: 'leBatch',
  24: 'geBatchSmall',
  25: 'leBatchSmall',
  203: 'selectLargeRefs',
  204: 'selectRef',
  205: 'selectSmallRefs',
  206: 'selectLargeRefEdge',
  207: 'selectLargeRefsEdge',
  253: 'nextOrIndex',
} as const

/**
  eq, 
  neq, 
  eqBatch, 
  neqBatch, 
  eqBatchSmall, 
  neqBatchSmall, 
  range, 
  nrange, 
  gt, 
  lt, 
  gtBatch, 
  ltBatch, 
  gtBatchSmall, 
  ltBatchSmall, 
  ge, 
  le, 
  geBatch, 
  leBatch, 
  geBatchSmall, 
  leBatchSmall, 
  selectLargeRefs, 
  selectRef, 
  selectSmallRefs, 
  selectLargeRefEdge, 
  selectLargeRefsEdge, 
  nextOrIndex 
 */
export type FilterOpCompareEnum = (typeof FilterOpCompare)[keyof typeof FilterOpCompare]

export type FilterOp = {
  prop: PropTypeEnum
  compare: FilterOpCompareEnum
}

export const FilterOpByteSize = 2

export const FilterOpAlignOf = 2

export const packFilterOp = (obj: FilterOp): bigint => {
  let val = 0n
  val |= (BigInt(obj.prop) & 255n) << 0n
  val |= (BigInt(obj.compare) & 255n) << 8n
  return val
}

export const unpackFilterOp = (val: bigint): FilterOp => {
  return {
    prop: (Number((val >> 0n) & 255n)) as PropTypeEnum,
    compare: (Number((val >> 8n) & 255n)) as FilterOpCompareEnum,
  }
}

export const writeFilterOp = (
  buf: Uint8Array,
  header: FilterOp,
  offset: number,
): number => {
  buf[offset] = Number(header.prop)
  offset += 1
  buf[offset] = Number(header.compare)
  offset += 1
  return offset
}

export const writeFilterOpProps = {
  prop: (buf: Uint8Array, value: PropTypeEnum, offset: number) => {
    buf[offset] = Number(value)
  },
  compare: (buf: Uint8Array, value: FilterOpCompareEnum, offset: number) => {
    buf[offset + 1] = Number(value)
  },
}

export const readFilterOp = (
  buf: Uint8Array,
  offset: number,
): FilterOp => {
  const value: FilterOp = {
    prop: (buf[offset]) as PropTypeEnum,
    compare: (buf[offset + 1]) as FilterOpCompareEnum,
  }
  return value
}

export const readFilterOpProps = {
    prop: (buf: Uint8Array, offset: number) => (buf[offset]) as PropTypeEnum,
    compare: (buf: Uint8Array, offset: number) => (buf[offset + 1]) as FilterOpCompareEnum,
}

export const createFilterOp = (header: FilterOp): Uint8Array => {
  const buffer = new Uint8Array(FilterOpByteSize)
  writeFilterOp(buffer, header, 0)
  return buffer
}

export const pushFilterOp = (
  buf: AutoSizedUint8Array,
  header: FilterOp,
): number => {
  const index = buf.length
  buf.pushU8(Number(header.prop))
  buf.pushU8(Number(header.compare))
  return index
}

export type FilterCondition = {
  op: FilterOp
  size: number
  prop: number
  start: number
  len: number
  fieldSchema: number
  offset: number
}

export const FilterConditionByteSize = 19

export const FilterConditionAlignOf = 16

export const packFilterCondition = (obj: FilterCondition): bigint => {
  let val = 0n
  val |= (packFilterOp(obj.op) & 65535n) << 0n
  val |= (BigInt(obj.size) & 4294967295n) << 16n
  val |= (BigInt(obj.prop) & 255n) << 48n
  val |= (BigInt(obj.start) & 65535n) << 56n
  val |= (BigInt(obj.len) & 255n) << 72n
  val |= (BigInt(obj.fieldSchema) & 18446744073709551615n) << 80n
  val |= (BigInt(obj.offset) & 255n) << 144n
  return val
}

export const unpackFilterCondition = (val: bigint): FilterCondition => {
  return {
    op: unpackFilterOp((val >> 0n) & 65535n),
    size: Number((val >> 16n) & 4294967295n),
    prop: Number((val >> 48n) & 255n),
    start: Number((val >> 56n) & 65535n),
    len: Number((val >> 72n) & 255n),
    fieldSchema: Number((val >> 80n) & 18446744073709551615n),
    offset: Number((val >> 144n) & 255n),
  }
}

export const writeFilterCondition = (
  buf: Uint8Array,
  header: FilterCondition,
  offset: number,
): number => {
  writeUint16(buf, Number(packFilterOp(header.op)), offset)
  offset += 2
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  buf[offset] = Number(header.prop)
  offset += 1
  writeUint16(buf, Number(header.start), offset)
  offset += 2
  buf[offset] = Number(header.len)
  offset += 1
  writeUint64(buf, header.fieldSchema, offset)
  offset += 8
  buf[offset] = Number(header.offset)
  offset += 1
  return offset
}

export const writeFilterConditionProps = {
  op: (buf: Uint8Array, value: FilterOp, offset: number) => {
    writeUint16(buf, Number(packFilterOp(value)), offset)
  },
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset + 2)
  },
  prop: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 6] = Number(value)
  },
  start: (buf: Uint8Array, value: number, offset: number) => {
    writeUint16(buf, Number(value), offset + 7)
  },
  len: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 9] = Number(value)
  },
  fieldSchema: (buf: Uint8Array, value: number, offset: number) => {
    writeUint64(buf, value, offset + 10)
  },
  offset: (buf: Uint8Array, value: number, offset: number) => {
    buf[offset + 18] = Number(value)
  },
}

export const readFilterCondition = (
  buf: Uint8Array,
  offset: number,
): FilterCondition => {
  const value: FilterCondition = {
    op: unpackFilterOp(BigInt(readUint16(buf, offset))),
    size: readUint32(buf, offset + 2),
    prop: buf[offset + 6],
    start: readUint16(buf, offset + 7),
    len: buf[offset + 9],
    fieldSchema: readUint64(buf, offset + 10),
    offset: buf[offset + 18],
  }
  return value
}

export const readFilterConditionProps = {
    op: (buf: Uint8Array, offset: number) => unpackFilterOp(BigInt(readUint16(buf, offset))),
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset + 2),
    prop: (buf: Uint8Array, offset: number) => buf[offset + 6],
    start: (buf: Uint8Array, offset: number) => readUint16(buf, offset + 7),
    len: (buf: Uint8Array, offset: number) => buf[offset + 9],
    fieldSchema: (buf: Uint8Array, offset: number) => readUint64(buf, offset + 10),
    offset: (buf: Uint8Array, offset: number) => buf[offset + 18],
}

export const createFilterCondition = (header: FilterCondition): Uint8Array => {
  const buffer = new Uint8Array(FilterConditionByteSize)
  writeFilterCondition(buffer, header, 0)
  return buffer
}

export const pushFilterCondition = (
  buf: AutoSizedUint8Array,
  header: FilterCondition,
): number => {
  const index = buf.length
  buf.pushU16(Number(packFilterOp(header.op)))
  buf.pushU32(Number(header.size))
  buf.pushU8(Number(header.prop))
  buf.pushU16(Number(header.start))
  buf.pushU8(Number(header.len))
  buf.pushU64(header.fieldSchema)
  buf.pushU8(Number(header.offset))
  return index
}

export type FilterSelect = {
  size: number
  typeEntry: number
  typeId: TypeId
}

export const FilterSelectByteSize = 14

export const FilterSelectAlignOf = 16

export const packFilterSelect = (obj: FilterSelect): bigint => {
  let val = 0n
  val |= (BigInt(obj.size) & 4294967295n) << 0n
  val |= (BigInt(obj.typeEntry) & 18446744073709551615n) << 32n
  val |= (BigInt(obj.typeId) & 65535n) << 96n
  return val
}

export const unpackFilterSelect = (val: bigint): FilterSelect => {
  return {
    size: Number((val >> 0n) & 4294967295n),
    typeEntry: Number((val >> 32n) & 18446744073709551615n),
    typeId: (Number((val >> 96n) & 65535n)) as TypeId,
  }
}

export const writeFilterSelect = (
  buf: Uint8Array,
  header: FilterSelect,
  offset: number,
): number => {
  writeUint32(buf, Number(header.size), offset)
  offset += 4
  writeUint64(buf, header.typeEntry, offset)
  offset += 8
  writeUint16(buf, Number(header.typeId), offset)
  offset += 2
  return offset
}

export const writeFilterSelectProps = {
  size: (buf: Uint8Array, value: number, offset: number) => {
    writeUint32(buf, Number(value), offset)
  },
  typeEntry: (buf: Uint8Array, value: number, offset: number) => {
    writeUint64(buf, value, offset + 4)
  },
  typeId: (buf: Uint8Array, value: TypeId, offset: number) => {
    writeUint16(buf, Number(value), offset + 12)
  },
}

export const readFilterSelect = (
  buf: Uint8Array,
  offset: number,
): FilterSelect => {
  const value: FilterSelect = {
    size: readUint32(buf, offset),
    typeEntry: readUint64(buf, offset + 4),
    typeId: (readUint16(buf, offset + 12)) as TypeId,
  }
  return value
}

export const readFilterSelectProps = {
    size: (buf: Uint8Array, offset: number) => readUint32(buf, offset),
    typeEntry: (buf: Uint8Array, offset: number) => readUint64(buf, offset + 4),
    typeId: (buf: Uint8Array, offset: number) => (readUint16(buf, offset + 12)) as TypeId,
}

export const createFilterSelect = (header: FilterSelect): Uint8Array => {
  const buffer = new Uint8Array(FilterSelectByteSize)
  writeFilterSelect(buffer, header, 0)
  return buffer
}

export const pushFilterSelect = (
  buf: AutoSizedUint8Array,
  header: FilterSelect,
): number => {
  const index = buf.length
  buf.pushU32(Number(header.size))
  buf.pushU64(header.typeEntry)
  buf.pushU16(Number(header.typeId))
  return index
}

