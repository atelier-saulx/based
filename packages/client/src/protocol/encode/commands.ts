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
import { EncodeDefinition, makeBuf, write } from './serializer'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

function defaultEncoder(schema: EncodeDefinition): (payload: any) => Buffer {
  return (payload) => {
    if (!Array.isArray(payload)) {
      payload = [payload]
    }

    const buf = makeBuf(schema, payload)
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
  'object.get': (payload) => {
    const [lang, nodeId, ...fields] = payload
    const fields_len = () => {
      if (!fields) return 0
      return fields.reduce(
        (acc, cur) =>
          acc + selva_proto_string_def.size + Buffer.byteLength(cur),
        0
      )
    }
    const msg = Buffer.alloc(
      selva_proto_string_def.size +
        (lang ? Buffer.byteLength(lang) : 0) + // lang
        selva_proto_string_def.size +
        SELVA_NODE_ID_LEN +
        fields_len()
    )

    let off = 0

    // lang
    off += serializeString(msg, off, lang || '')

    off += serializeId(msg, off, nodeId)

    // opt fields
    for (const field of fields) {
      off += serializeString(msg, off, field)
    }

    return msg
  },
  modify: (payload) => {
    const [nodeId, fields] = payload

    const head = Buffer.alloc(
      selva_proto_array_def.size +
        selva_proto_string_def.size +
        SELVA_NODE_ID_LEN +
        selva_proto_string_def.size +
        0 // flags
    )
    let off = 0

    off += serializeWithOffset(selva_proto_array_def, head, off, {
      type: SELVA_PROTO_ARRAY,
      length: 2 + 3 * fields.length,
    })

    // nodeId
    off += serializeId(head, off, nodeId)

    // flags
    off += serializeWithOffset(selva_proto_string_def, head, off, {
      type: SELVA_PROTO_STRING,
      bsize: 0,
    })

    const fieldsBuf = fields.map(([field, value]) => {
      if (typeof value == 'string') {
        const buf = Buffer.alloc(
          selva_proto_string_def.size +
            1 + // mod type
            selva_proto_string_def.size +
            Buffer.byteLength(field, 'utf8') +
            selva_proto_string_def.size +
            Buffer.byteLength(value, 'utf8')
        )
        let boff = 0

        boff += serializeString(buf, boff, '0')
        boff += serializeString(buf, boff, field)
        boff += serializeString(buf, boff, value)

        return buf
      } else if (typeof value == 'number') {
        const buf = Buffer.alloc(
          selva_proto_string_def.size +
            1 + // mod type
            selva_proto_string_def.size +
            Buffer.byteLength(field, 'utf8') +
            selva_proto_string_def.size +
            8
        )
        let boff = 0

        const bv = Buffer.allocUnsafe(8)
        bv.writeBigUInt64LE(BigInt(value))

        boff += serializeString(buf, boff, '3')
        boff += serializeString(buf, boff, field)
        boff += serializeBin(buf, boff, bv) // We currently send nums as bin buffers

        return buf
      } else if (Array.isArray(value)) {
        // set
        const opSet = createRecord(opSetDefCstring, {
          op_set_type: OP_SET_TYPE.char,
          $value: value.map((s) => `${s}\0`).join(''),
        })
        const buf = Buffer.alloc(
          selva_proto_string_def.size +
            1 + // mod type
            selva_proto_string_def.size +
            Buffer.byteLength(field, 'utf8') +
            selva_proto_string_def.size +
            opSet.length
        )
        let boff = 0

        boff += serializeString(buf, boff, '5')
        boff += serializeString(buf, boff, field)
        boff += serializeBin(buf, boff, opSet)

        return buf
      } else {
        throw new Error()
      }
    })

    return Buffer.concat([head, ...fieldsBuf])
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
