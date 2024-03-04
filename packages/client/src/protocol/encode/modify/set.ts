import { createRecord } from 'data-record'
import { SELVA_NODE_ID_LEN } from '../../types.js'
import {
  SET_TYPE_TO_MODIFY_VALUE_TYPE,
  ModifyOpSetType,
  OP_SET_TYPE,
  SET_OP_BY_TYPE,
  ORD_SET_OP_BY_TYPE,
  ORD_SET_MODE,
} from './types.js'

type OpSetType = typeof OP_SET_TYPE[keyof typeof OP_SET_TYPE]
type OrdSetMode = typeof ORD_SET_MODE[keyof typeof ORD_SET_MODE]

// Constraint ids.
const EDGE_FIELD_CONSTRAINT_ID_DEFAULT = 0
const EDGE_FIELD_CONSTRAINT_SINGLE_REF = 1
const EDGE_FIELD_CONSTRAINT_DYNAMIC = 2

function getConstraintId({
  isSingle,
  isBidirectional,
}: {
  isSingle: boolean
  isBidirectional: boolean
}) {
  if (isBidirectional) {
    return EDGE_FIELD_CONSTRAINT_DYNAMIC
  }

  return isSingle ? EDGE_FIELD_CONSTRAINT_SINGLE_REF : EDGE_FIELD_CONSTRAINT_ID_DEFAULT
}

function refsToStr(ary: string[] = []): string {
  if (!ary) {
    return ''
  }

  return ary.map((s: string) => s.padEnd(SELVA_NODE_ID_LEN, '\0')).join('')
}

function strsToStr(ary: string[] = []): string {
  return ary.map((s: string) => `${s}\0`).join('')
}

export function encodeSetOperation({
  setType,
  isSingle,
  sortable,
  isBidirectional,
  $value,
  $add,
  $remove,
  $delete,
}: {
  setType: OpSetType
  isSingle?: boolean
  sortable?: boolean
  isBidirectional?: boolean
  $value?: any | any[]
  $add?: any | any[]
  $remove?: any | any[]
  $delete?: boolean
}): Buffer {
  if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
      constraint_id: getConstraintId({ isSingle, isBidirectional }),
      delete_all: !!($delete || $value?.length === 0 || (sortable && $value?.length)),
      $value: refsToStr($value),
      $add: refsToStr($add),
      $delete: refsToStr($remove),
    })
  } else if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      delete_all: $delete || $value?.length === 0,
      $value: strsToStr($value),
      $add: strsToStr($add),
      $delete: strsToStr($remove),
    })
  }

  const encoder = SET_TYPE_TO_MODIFY_VALUE_TYPE[setType]
  return createRecord(SET_OP_BY_TYPE[setType], {
    op_set_type: setType,
    delete_all: $delete || $value?.length === 0,
    $value: ($value || []).map(encoder),
    $add: ($add || []).map(encoder),
    $delete: ($remove || []).map(encoder),
  })
}

export function encodeOrdSetOperation({
  setType,
  mode,
  index,
  $value,
}: {
  setType: OpSetType
  mode: OrdSetMode
  index: number
  $value?: any | any[]
}): Buffer {

  if (setType !== ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    throw new Error('setType not supported')
  }

  return createRecord(ORD_SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      mode,
      constraint_id: EDGE_FIELD_CONSTRAINT_DYNAMIC, // always dynamic
      index: index | 0,
      $value: refsToStr($value),
  })
}
