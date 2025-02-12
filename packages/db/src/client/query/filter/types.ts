import { FilterCtx, Operator } from './operators.js'
import { FilterBranch } from './FilterBranch.js'

export type Filter = [fieldStr: string, ctx: FilterCtx, value: any]

export type FilterBranchFn = (filterBranch: FilterBranch) => void

export type FilterAst = (Filter | FilterAst)[]

export const IsFilter = (f: FilterAst): f is Filter => {
  if (typeof f[0] === 'string') {
    return true
  }
  return false
}
