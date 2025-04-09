import { LangName } from '@based/schema'
import { ModifyError } from './ModifyRes.js'

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

export const SWITCH_TYPE = 2
export const SWITCH_FIELD = 0
export const SWITCH_ID_CREATE = 9
export const SWITCH_ID_UPDATE = 1

export const enum SIZE {
  DEFAULT_CURSOR = 11,
}

export type ModifyErr = typeof RANGE_ERR | ModifyError | void
export type ModifyOp =
  | typeof CREATE
  | typeof UPDATE
  | typeof INCREMENT
  | typeof EXPIRE

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
