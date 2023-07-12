import { createRecord } from 'data-record'
import { SELVA_NODE_ID_LEN } from '../../types'
import { ModifyOpSetType, SET_OP_BY_TYPE } from './types'
import { SET_TYPE_TO_MODIFY_VALUE_TYPE } from './types'

function refsToStr(ary: string[] = []): string {
  return ary.map((s: string) => `${s.padEnd(SELVA_NODE_ID_LEN)}`).join('')
}

function strsToStr(ary: string[] = []): string {
  return ary.map((s: string) => `${s}\0`).join('')
}

export function encodeSetOperation({
  setType,
  $value,
  $add,
  $delete,
}: {
  setType: number
  $value?: any | any[]
  $add?: any | any[]
  $delete?: any | any[]
}): Buffer {
  if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    console.log('hmm', setType, $value)
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
      contraint_id: 0, // TODO: impl. bidirectional
      delete_all: $delete,
      $value: refsToStr($value),
      $add: refsToStr($add),
      $delete: refsToStr($delete),
    })
  } else if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      delete_all: $delete,
      $value: strsToStr($value),
      $add: strsToStr($add),
      $delete: strsToStr($delete),
    })
  }

  const encoder = SET_TYPE_TO_MODIFY_VALUE_TYPE[setType]
  return createRecord(SET_OP_BY_TYPE[setType], {
    op_set_type: setType,
    $value: $value.map(encoder),
  })
}
