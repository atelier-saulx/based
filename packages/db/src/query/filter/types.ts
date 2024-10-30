import { Operator } from './operators.js'

export type Filter = [fieldStr: string, operator: Operator, value: any]
