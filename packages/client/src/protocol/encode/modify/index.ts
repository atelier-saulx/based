import { SELVA_PROTO_STRING } from '../../types'
import { defaultEncoder } from '../defaultEncoder'
import { encodeLongLong, encodeDouble } from './primitiveTypes'
import { EncodeDefinition } from '../protocol'
import { encodeSetOperation } from './set'
import { ModifyArgType } from './types'
import { encodeArrayOp } from './array'
import { encodeHll } from './hll'
import { encodeObjMeta } from './objMeta'

// note: just the non-string values are represented here
export const VALUE_TYPES = {
  [ModifyArgType.SELVA_MODIFY_ARG_DEFAULT_LONGLONG]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_LONGLONG]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_DEFAULT_DOUBLE]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_DOUBLE]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_SET]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_PUSH]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_REMOVE]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_HLL]: { type: 'bin' },
  [ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META]: { type: 'bin' },
}

function identity<T>(x: T): T {
  return x
}

// note: only types with need for additional value encoding are present
export const VALUE_ENCODERS = {
  [ModifyArgType.SELVA_MODIFY_ARG_DEFAULT_LONGLONG]: encodeLongLong,
  [ModifyArgType.SELVA_MODIFY_ARG_LONGLONG]: encodeLongLong,
  [ModifyArgType.SELVA_MODIFY_ARG_DEFAULT_DOUBLE]: encodeDouble,
  [ModifyArgType.SELVA_MODIFY_ARG_DOUBLE]: encodeDouble,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_SET]: encodeSetOperation,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_HLL]: encodeHll,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_PUSH]: encodeArrayOp,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT]: encodeArrayOp,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_REMOVE]: encodeArrayOp,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META]: encodeObjMeta,
}

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

  for (let i = 0; i < fields.length; i += 3) {
    const opType = fields[i]
    const name = fields[i + 1]
    const value = fields[i + 2]

    if (name === 'type') {
      // type is a protected field
      continue
    }

    if (
      value?.$delete === true &&
      opType !== ModifyArgType.SELVA_MODIFY_ARG_OP_SET
    ) {
      defs.push({ type: 'string' }, { type: 'string' }, { type: 'string' })
      setFields.push(ModifyArgType.SELVA_MODIFY_ARG_OP_DEL, name, '')
      continue
    }

    defs.push(
      { type: 'string' },
      { type: 'string' },
      VALUE_TYPES[opType] || { type: 'string' }
    )

    const encoder = VALUE_ENCODERS[opType] || identity
    setFields.push(opType, name, encoder(value))
  }

  const schema: EncodeDefinition = [{ type: 'array', values: defs }]
  const buf = defaultEncoder(schema)([setFields])
  return buf
}
