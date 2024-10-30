import { Operator } from './operators.js'
import { FilterBranch } from './FilterBranch.js'

export type Filter = [fieldStr: string, operator: Operator, value: any]

export type FilterBranchFn = (filterBranch: FilterBranch) => void
