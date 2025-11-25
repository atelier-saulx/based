import type { LangName } from '../../schema/lang.js'
import { ModOp } from '../../zigTsExports.js'

export const RANGE_ERR = 1
export const MOD_OPS_TO_STRING = {
  [ModOp.createProp]: 'create',
  [ModOp.updateProp]: 'update',
  [ModOp.increment]: 'update',
  [ModOp.expire]: 'update',
} as const

export const enum SIZE {
  DEFAULT_CURSOR = 11,
}

export type ModifyOpts = {
  unsafe?: boolean
  locale?: LangName
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
