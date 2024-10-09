import { deepEqual as uDeepEqual } from '@saulx/utils'
import util from 'node:util'
import { BasedIterable } from '../../src/query/BasedIterable.js'

export const deepEqual = (a, b, msg?: string) => {
  if (!uDeepEqual(a, b)) {
    const m = `${msg || ``}
------------------ EXPECTED ----------------------
${util.inspect(b, { depth: 10 })}
------------------- ACTUAL -----------------------
${util.inspect(a, { depth: 10 })}
--------------------------------------------------`
    throw new Error(m)
  }
}

export const equal = deepEqual

const SORT_ERR_MSG = 'Incorrect sort oder'

export const isSorted = (
  a: BasedIterable,
  field: string,
  order: 'asc' | 'desc' = 'asc',
  msg?: string,
) => {
  let last: any
  let i = 0
  for (const result of a) {
    i++
    const current = result[field]
    if (last !== undefined) {
      if (typeof last === 'string') {
        if (order === 'asc') {
          if (last.localeCompare(current) == 1) {
            throw new Error(msg || SORT_ERR_MSG + ' String')
          }
        } else if (last.localeCompare(current) == -1) {
          throw new Error(msg || SORT_ERR_MSG + ' String')
        }
      } else {
        if (order === 'asc') {
          if (last > current) {
            throw new Error(msg || SORT_ERR_MSG)
          }
        } else if (last < current) {
          throw new Error(msg || SORT_ERR_MSG)
        }
      }
    }
    last = current
  }
  if (i === 0) {
    throw new Error(msg ?? '' + ' isSorted empty result')
  }
}
