import { createRecord } from 'data-record'
import {
  Command,
  SELVA_PROTO_STRING,
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
        case '2': // default string (set if not yet set)
        case '0': // string
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'string' })
          setFields.push(opType, name, value)
          continue
        case '8': // default longlong (set if not yet set)
        case '3': // number
          const iBuf = Buffer.allocUnsafe(8)
          iBuf.writeBigUInt64LE(BigInt(value))
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'bin' })
          setFields.push(opType, name, iBuf)
          continue
        case '9': // default double (set if not yet set)
        case 'A': //double
          const dBuf = Buffer.allocUnsafe(8)
          dBuf.writeDoubleLE(value)
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'bin' })
          setFields.push(opType, name, dBuf)
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
