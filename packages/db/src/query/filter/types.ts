import { Operator } from './operators.js'

export type Filter = [fieldStr: string, operator: Operator, value: any]

export const isFilter = (f: any[]): f is Filter => {
  if (f.length > 3) {
    return false
  }
  return true
}
