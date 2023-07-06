import { serialize, CompiledRecordDef } from 'data-record'
import {
  Command,
  SELVA_NODE_ID_LEN,
  SELVA_PROTO_DOUBLE,
  SELVA_PROTO_LONGLONG,
  SELVA_PROTO_STRING,
  selva_proto_double_def,
  selva_proto_longlong_def,
  selva_proto_string_def,
} from '../types'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

export const COMMAND_ENCODERS: CommandEncoders = {
  ping: null,
  lscmd: null,
  echo: (payload) => {
    const head = Buffer.alloc(selva_proto_string_def.size + payload.length)
    let off = 0

    off += serializeString(head, off, payload)
    return head
  },
  'object.set': (payload) => {
    const [id, field, valueId, value] = payload
    const strVal = String(value)

    let buflen = 0
    buflen += selva_proto_string_def.size + SELVA_NODE_ID_LEN // id
    buflen += selva_proto_string_def.size + Buffer.byteLength(field) // field
    buflen += selva_proto_string_def.size + Buffer.byteLength(valueId) // value type
    buflen += selva_proto_string_def.size + Buffer.byteLength(strVal) // value

    const head = Buffer.alloc(buflen)
    let off = 0

    off += serializeId(head, off, id)
    off += serializeString(head, off, field)
    off += serializeString(head, off, valueId)
    off += serializeString(head, off, strVal)

    console.log('lol', payload, id, field, valueId, strVal)
    console.log('HEAD', head.toString('utf8'))
    return head
  },
  'object.get': (payload) => {
    return Buffer.from(JSON.stringify(payload))
  },
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

function serializeId(buf: Buffer, off: number, id: string): number {
  const off1 = serializeWithOffset(selva_proto_string_def, buf, off, {
    type: SELVA_PROTO_STRING,
    bsize: SELVA_NODE_ID_LEN,
  })

  buf.write(id, off1, SELVA_NODE_ID_LEN, 'latin1')
  const off2 = SELVA_NODE_ID_LEN
  return off1 + off2
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
