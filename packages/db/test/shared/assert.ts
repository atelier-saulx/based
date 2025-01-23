import { deepEqual as uDeepEqual } from '@saulx/utils'
import util from 'node:util'
import { BasedQueryResponse } from '../../src/client/query/BasedIterable.js'
import color from 'picocolors'

export const deepEqual = (a, b, msg?: string) => {
  if (!uDeepEqual(a, b)) {
    const m = `${msg || ``}
------------------ EXPECTED ----------------------
${util.inspect(b, { depth: 10, maxStringLength: 60 })}
------------------- ACTUAL -----------------------
${util.inspect(a, { depth: 10, maxStringLength: 60 })}
--------------------------------------------------`
    const error = new Error(m)
    throw error
  }
}

export const equal = deepEqual

const SORT_ERR_MSG = 'Incorrect sort oder'

export const isSorted = (
  a: BasedQueryResponse,
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
            throw new Error(msg || SORT_ERR_MSG + ` String "${field}"`)
          }
        } else if (last.localeCompare(current) == -1) {
          throw new Error(msg || SORT_ERR_MSG + ` String "${field}"`)
        }
      } else {
        if (order === 'asc') {
          if (last > current) {
            throw new Error(msg || SORT_ERR_MSG + ` "${field}"`)
          }
        } else if (last < current) {
          throw new Error(msg || SORT_ERR_MSG + ` "${field}"`)
        }
      }
    }
    last = current
  }
  if (i === 0) {
    throw new Error(msg ?? '' + ' isSorted empty result')
  }
}

export const throws = async (
  fn: () => Promise<any>,
  logErr?: boolean,
  label?: string,
) => {
  try {
    await fn()
    const e = new Error('')
    e.stack =
      '\n' +
      (label ?? fn.toString().replace('() =>', '') + '\n\n should throw \n') +
      e.stack.split('\n').slice(-1).join('')
    throw e
  } catch (err) {
    if (logErr) {
      console.log('')
      if (label) {
        console.log(color.gray(`${label} "${err.message}"`))
      } else {
        console.log(color.gray(err.message))
      }
      console.log('')
    }
  }
}
