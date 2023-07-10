import { createRecord } from 'data-record'
import { ModifyOpSetType, SET_OP_BY_TYPE } from './types'
import { SET_TYPE_TO_MODIFY_VALUE_TYPE } from './types'

export function encodeSetOperation({
  setType,
  $value,
}: {
  setType: number
  $value?: any | any[]
  $add?: any | any[]
  $delete?: any | any[]
}): Buffer {
  if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      contraint_id: 0, // TODO: bidirectional constraint
      delete_all: false, // TODO: add support
      $value: $value.map((s: string) => `${s}\0`).join(''),
    })
  } else if (setType === ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR) {
    return createRecord(SET_OP_BY_TYPE[setType], {
      op_set_type: setType,
      $value: $value.map((s: string) => `${s}\0`).join(''),
    })
  }

  const encoder = SET_TYPE_TO_MODIFY_VALUE_TYPE[setType]
  return createRecord(SET_OP_BY_TYPE[setType], {
    op_set_type: setType,
    $value: $value.map(encoder),
  })
}
