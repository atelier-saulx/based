import { ModifyError } from './ModifyRes.js'

export const CREATE = 3
export const UPDATE = 6
export const DELETE = 11
export const MERGE_MAIN = 4
export const RANGE_ERR = 1

export type ModifyErr = typeof RANGE_ERR | ModifyError | void
export type ModifyOp = typeof CREATE | typeof UPDATE
