export const CREATE = 3
export const UPDATE = 6
export const MERGE_MAIN = 4
export const DELETE_FIELD = 11
export const REFS_PUT = 0
export const REFS_ADD = 1
export const REFS_DELETE = 2
export const REFS_UPDATE = 3

export type ModifyOp = typeof CREATE | typeof UPDATE
