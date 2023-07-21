import { createRecord } from 'data-record'
import { SELVA_NODE_ID_LEN } from '../../types'
import { ModifyOpSetType, SET_OP_BY_TYPE } from './types'
import { SET_TYPE_TO_MODIFY_VALUE_TYPE } from './types'

function refsToStr(ary: string[] = []): string {
  return ary.map((s: string) => s.padEnd(SELVA_NODE_ID_LEN, '\0')).join('')
}

function strsToStr(ary: string[] = []): string {
  return ary.map((s: string) => `${s}\0`).join('')
}

export function encodeSetOperation({
  setType,
  $value,
  $add,
  $remove,
}: {
  setType: number
  $value?: any | any[]
  $add?: any | any[]
  $remove?: any | any[]
}): Buffer {
  if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
      contraint_id: 0, // TODO: impl. bidirectional
      delete_all: $remove,
      $value: refsToStr($value),
      $add: refsToStr($add),
      $delete: refsToStr($remove),
    })
  } else if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      delete_all: $remove,
      $value: strsToStr($value),
      $add: strsToStr($add),
      $delete: strsToStr($remove),
    })
  }

  const encoder = SET_TYPE_TO_MODIFY_VALUE_TYPE[setType]
  return createRecord(SET_OP_BY_TYPE[setType], {
    op_set_type: setType,
    $value: $value.map(encoder),
  })
}
