import { createRecord } from 'data-record'
import { SELVA_NODE_ID_LEN } from '../../types.js'
import {
  SET_TYPE_TO_MODIFY_VALUE_TYPE,
  ModifyOpSetType,
  SET_OP_BY_TYPE,
} from './types.js'

// TODO: impl. bidirectional
function getConstraint({
  isSingle,
  isBidirectional,
}: {
  isSingle: boolean
  isBidirectional: boolean
}) {
  if (isBidirectional) {
    return 2
  }

  return isSingle ? 1 : 0
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
  isBidirectional,
  $value,
  $add,
  $remove,
  $delete,
}: {
  setType: number
  isSingle?: boolean
  isBidirectional?: boolean
  $value?: any | any[]
  $add?: any | any[]
  $remove?: any | any[]
  $delete?: boolean
}): Buffer {
  if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
      constraint_id: getConstraint({ isSingle, isBidirectional }),
      delete_all: $delete || $value?.length === 0,
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
