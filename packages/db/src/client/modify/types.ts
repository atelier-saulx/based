import { LangName } from '@based/schema'

export const CREATE = 3
export const UPDATE = 6

export const UPDATE_PARTIAL = 5
export const DELETE = 11
export const DELETE_SORT_INDEX = 4
export const DELETE_NODE = 10
export const RANGE_ERR = 1
export const INCREMENT = 12
export const DECREMENT = 13
export const EXPIRE = 14
export const ADD_EMPTY_SORT_TEXT = 15
export const ADD_EMPTY_SORT = 7
export const DELETE_TEXT_FIELD = 16
export const PADDING = 255

export const SWITCH_TYPE = 2
export const SWITCH_FIELD = 0
export const SWITCH_ID_CREATE = 9
export const SWITCH_ID_CREATE_UNSAFE = 8
export const SWITCH_ID_UPDATE = 1
export const UPSERT = 17

export type ModifyOp =
  | typeof CREATE
  | typeof UPDATE
  | typeof INCREMENT
  | typeof EXPIRE

export const MOD_OPS_TO_STRING: Record<ModifyOp, 'create' | 'update'> = {
  [CREATE]: 'create',
  [UPDATE]: 'update',
  [INCREMENT]: 'update',
  [EXPIRE]: 'update',
}

export const enum SIZE {
  DEFAULT_CURSOR = 11,
}

// export type ModifyErr = typeof RANGE_ERR | ModifyError | void

export type ModifyOpts = {
  unsafe?: boolean
  locale?: LangName
  overwrite?: boolean
}

export const NOEDGE_NOINDEX_REALID = 0
export const EDGE_NOINDEX_REALID = 1
export const EDGE_INDEX_REALID = 2
export const NOEDGE_INDEX_REALID = 3
export const NOEDGE_NOINDEX_TMPID = 4
export const EDGE_NOINDEX_TMPID = 5
export const EDGE_INDEX_TMPID = 6
export const NOEDGE_INDEX_TMPID = 7

export const REF_OP_OVERWRITE = 0
export const REF_OP_UPDATE = 1
export const REF_OP_DELETE = 2
export const REF_OP_PUT_OVERWRITE = 3
export const REF_OP_PUT_ADD = 4

export type RefOp = typeof REF_OP_OVERWRITE | typeof REF_OP_UPDATE
