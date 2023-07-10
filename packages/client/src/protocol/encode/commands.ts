import {
  serialize,
  CompiledRecordDef,
  createRecord,
  compile,
} from 'data-record'
import {
  Command,
  SELVA_NODE_ID_LEN,
  SELVA_PROTO_DOUBLE,
  SELVA_PROTO_LONGLONG,
  SELVA_PROTO_STRING,
  selva_proto_double_def,
  selva_proto_longlong_def,
  selva_proto_string_def,
  selva_proto_array_def,
  SELVA_PROTO_ARRAY,
  SELVA_PROTO_STRING_FBINARY,
  opSetDefCstring,
  OP_SET_TYPE,
} from '../types'
import { EncodeDefinition, bufLen, write } from './serializer'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

function defaultEncoder(schema: EncodeDefinition): (payload: any) => Buffer {
  return (payload) => {
    if (!Array.isArray(payload)) {
      payload = [payload]
    }

    const buf = Buffer.alloc(bufLen(schema, payload))
    write(buf, schema, payload)
    return buf
  }
}

export const COMMAND_ENCODERS: CommandEncoders = {
  ping: null,
  lscmd: null,
  echo: defaultEncoder([{ type: 'string' }]),
  // id, field, valueId, value
  'object.set': defaultEncoder([
    { type: 'id' },
    { type: 'string' },
    { type: 'string' },
    { type: 'string' },
  ]),
  'object.get': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'id' },
    { type: 'string', vararg: true }, // ...fields
  ]),
  modify: (payload) => {
    const [nodeId, fields] = payload

    const defs: EncodeDefinition = [
      { type: 'id' },
      { type: 'raw', rawType: SELVA_PROTO_STRING, bsize: 0 },
    ]

    const setFields: any[] = [
      nodeId,
      { type: 'raw', rawType: SELVA_PROTO_STRING, bsize: 0 },
    ]

    for (let i = 0; i < fields.length; i += 3) {
      const opType = fields[i]
      const name = fields[i + 1]
      const value = fields[i + 2]

      switch (opType) {
        case '0': // string
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'string' })
          setFields.push(opType, name, value)
          continue
        case '3': // number
          const iBuf = Buffer.allocUnsafe(8)
          iBuf.writeBigUInt64LE(BigInt(value))
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'bin' })
          setFields.push(opType, name, iBuf)
          continue
        case '5': // set
          const opSet = createRecord(opSetDefCstring, {
            op_set_type: OP_SET_TYPE.char,
            $value: value.map((s: string) => `${s}\0`).join(''),
          })
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'bin' })
          setFields.push(opType, name, opSet)
          continue
        default:
          continue
      }
    }

    const schema: EncodeDefinition = [{ type: 'array', values: defs }]
    const buf = defaultEncoder(schema)([setFields])
    return buf
  },
  'hierarchy.find': (payload) => {
    return Buffer.from('hello')
  },
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
