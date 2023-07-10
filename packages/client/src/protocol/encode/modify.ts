import { SELVA_PROTO_STRING } from '../types'
import { defaultEncoder } from './defaultEncoder'
import { encodeLongLong, encodeDouble } from './primitiveTypes'
import { EncodeDefinition } from './protocol'
import { encodeSetOperation } from './set'

export function modify(payload: [nodeId: string, ...fields: any]) {
  const [nodeId, fields] = payload

  const defs: EncodeDefinition = [
    { type: 'id' },
    { type: 'raw', rawType: SELVA_PROTO_STRING, bsize: 0 },
  ]

  const setFields: any[] = [
    nodeId,
    { type: 'raw', rawType: SELVA_PROTO_STRING, bsize: 0 },
  ]

  const VALUE_TYPES = {
    2: { type: 'string' },
    0: { type: 'string' },
    8: { type: 'bin' },
    3: { type: 'bin' },
    9: { type: 'bin' },
    A: { type: 'bin' },
    5: { type: 'bin' },
  }

  const VALUE_ENCODERS = {
    2: (x: string) => x,
    0: (x: string) => x,
    8: encodeLongLong,
    3: encodeLongLong,
    9: encodeDouble,
    A: encodeDouble,
    5: encodeSetOperation,
  }

  for (let i = 0; i < fields.length; i += 3) {
    const opType = fields[i]
    const name = fields[i + 1]
    const value = fields[i + 2]

    defs.push(
      { type: 'string' },
      { type: 'string' },
      VALUE_TYPES[opType] || { type: 'string' }
    )
    setFields.push(opType, name, VALUE_ENCODERS[opType](value))
  }

  const schema: EncodeDefinition = [{ type: 'array', values: defs }]
  const buf = defaultEncoder(schema)([setFields])
  return buf
}
