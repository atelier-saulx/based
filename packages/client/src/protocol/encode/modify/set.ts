import { createRecord } from 'data-record'
import { opSetDefCstring, OP_SET_TYPE } from '../../types'

type SetType = 'reference' | 'char' | 'longlong' | 'double'

// TODO: make
// TODO: include delete_all option
// TODO: include edge constraint stuff?
export function encodeSetOperation(setOperation: {
  setType: string // value type code
  $value: any | any[]
  $add: any | any[]
  $delete: any | any[]
}): Buffer {
  const opSet = createRecord(opSetDefCstring, {
    op_set_type: OP_SET_TYPE.char,
    $value: setOperation.$value.map((s: string) => `${s}\0`).join(''),
  })

  return opSet
}

function encodeValue(setType: SetType, val: any) {}
