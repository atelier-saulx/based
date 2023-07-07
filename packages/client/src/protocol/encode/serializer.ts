import {
  SELVA_NODE_ID_LEN,
  SELVA_PROTO_DOUBLE,
  SELVA_PROTO_LONGLONG,
  SELVA_PROTO_STRING,
  selva_proto_double_def,
  selva_proto_longlong_def,
  selva_proto_string_def,
  SELVA_PROTO_STRING_FBINARY,
} from '../types'

import { CompiledRecordDef, serialize } from 'data-record'

export type EncodePrimiteTypes = {
  type: 'id' | 'string' | 'bin' | 'longlong' | 'double'
  vararg?: true
}
export type EncodeArrayType = { type: 'array'; values: EncodeDefinition }
export type EncodeType = EncodePrimiteTypes | EncodeArrayType

export type EncodeDefinition = EncodeType[]

export function write(
  buf: Buffer, // BYOB, bring your own buffer
  schema: EncodeDefinition,
  payload: any[]
): number {
  let off = 0
  for (let i = 0; i < payload.length; i++) {
    const def = schema[i]
    const val = payload[i]

    off += serializeValue(buf, off, def ?? schema[schema.length - 1], val)
  }
  return off
}

export function bufLen(schema: EncodeDefinition, payload: any[]): number {
  let len = 0
  for (let i = 0; i < payload.length; i++) {
    let def = schema[i]
    const val = payload[i]

    if (!def) {
      def = def ?? schema[schema.length - 1]
    }

    switch (def.type) {
      case 'id':
        len += selva_proto_string_def.size + SELVA_NODE_ID_LEN
        continue
      case 'string':
        len += selva_proto_string_def.size + Buffer.byteLength(val)
        continue
      case 'bin':
        len += selva_proto_string_def.size + val.length
        continue
      case 'longlong':
        len += selva_proto_longlong_def.size
        continue
      case 'double':
        len += selva_proto_double_def.size
        continue
      case 'array':
        len += bufLen(def.values, val)
      default:
        continue
    }
  }

  return len
}

function serializeValue(
  buf: Buffer,
  off: number,
  def: EncodeType,
  val: any
): number {
  switch (def.type) {
    case 'id':
      return serializeId(buf, off, val)
    case 'string':
      return serializeString(buf, off, val)
    case 'bin':
      return serializeBin(buf, off, val)
    case 'longlong':
      return serializeLongLong(buf, off, val)
    case 'double':
      return serializeDouble(buf, off, val)
    case 'array':
      return write(buf, def.values, val)
    default:
      return 0
  }
}

function serializeId(head: Buffer, off: number, id: string): number {
  let put = 0
  put += serializeWithOffset(selva_proto_string_def, head, off, {
    type: SELVA_PROTO_STRING,
    bsize: SELVA_NODE_ID_LEN,
  })
  head.write(id, off + put, SELVA_NODE_ID_LEN, 'latin1')
  put += SELVA_NODE_ID_LEN
  return put
}

function serializeString(buf: Buffer, off: number, str: string): number {
  const bsize = Buffer.byteLength(str, 'utf8')

  const wr1 = serializeWithOffset(selva_proto_string_def, buf, off, {
    type: SELVA_PROTO_STRING,
    bsize,
  })
  const wr2 = buf.write(str, off + wr1, bsize, 'utf8')
  if (wr2 != bsize) {
    throw new Error('Buffer overflow')
  }

  return wr1 + wr2
}

function serializeLongLong(buf, off, v) {
  return serializeWithOffset(selva_proto_longlong_def, buf, off, {
    type: SELVA_PROTO_LONGLONG,
    v: BigInt(v),
  })
}

function serializeDouble(buf, off, v) {
  return serializeWithOffset(selva_proto_double_def, buf, off, {
    type: SELVA_PROTO_DOUBLE,
    v,
  })
}

function serializeWithOffset(
  def: CompiledRecordDef,
  buf: Buffer,
  off: number,
  obj: any
): number {
  serialize(def, buf.slice(off, off + def.size), obj)
  return def.size
}

function serializeBin(buf: Buffer, off: number, v: Buffer) {
  const wr1 = serializeWithOffset(selva_proto_string_def, buf, off, {
    type: SELVA_PROTO_STRING,
    flags: SELVA_PROTO_STRING_FBINARY,
    bsize: v.length,
  })
  const wr2 = v.copy(buf, off + wr1)

  return wr1 + wr2
}
