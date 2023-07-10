import { createRecord } from 'data-record'
import { opSetDefCstring, OP_SET_TYPE, SET_OP_BY_TYPE } from '../../types'
import { encodeDouble, encodeLongLong } from './primitiveTypes'

const SET_TYPE_TO_MODIFY_VALUE_TYPE: Record<number, (t: any) => Buffer | null> =
  {
    0: null,
    1: null,
    2: encodeDouble,
    3: encodeLongLong,
  }

// TODO: make
// TODO: include delete_all option
// TODO: include edge constraint stuff?
export function encodeSetOperation({
  setType,
  $value,
}: {
  setType: number
  $value: any | any[]
  $add: any | any[]
  $delete: any | any[]
}): Buffer {
  const encoder = SET_TYPE_TO_MODIFY_VALUE_TYPE[setType]

  // if string
  if (!encoder) {
    return createRecord(opSetDefCstring, {
      op_set_type: OP_SET_TYPE.char,
      $value: $value.map((s: string) => `${s}\0`).join(''),
    })
  }

  return createRecord(SET_OP_BY_TYPE[setType], {
    op_set_type: setType,
    $value: $value.map(encoder),
  })
}
