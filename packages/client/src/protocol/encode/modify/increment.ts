import { createRecord } from 'data-record'
import { ModifyArgType, incrementDef, incrementDoubleDef } from './types.js'

const DEFS = {
  [ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT]: incrementDef,
  [ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE]: incrementDoubleDef,
}

export function encodeIncrement(
  x: { $default: number; $increment: number },
  opType: ModifyArgType
): Buffer {
  return createRecord(DEFS[opType], {
    $default:
      opType === ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT
        ? BigInt(x.$default)
        : x.$default,
    $increment:
      opType === ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT
        ? BigInt(x.$increment)
        : x.$increment,
  })
}
