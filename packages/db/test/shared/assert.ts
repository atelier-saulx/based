import { deepEqual as uDeepEqual } from '@saulx/utils'
import util from 'node:util'
import { BasedQueryResponse } from '../../src/client/query/BasedIterable.js'
import color from 'picocolors'
import * as jsondiffpatch from 'jsondiffpatch'
import * as c from 'jsondiffpatch/formatters/console'
import { hash } from '@saulx/hash'
import { REVERSE_TYPE_INDEX_MAP, TIMESTAMP } from '@based/schema/def'

const diffpatcher = jsondiffpatch.create({
  // objectHash: function (obj) {
  //   return String(hash(obj))
  // },
})

// add fn
export const deepEqual = (a, b, msg?: string) => {
  if (a instanceof BasedQueryResponse) {
    a = a.toObject()
  }

  if (!uDeepEqual(a, b)) {
    if (typeof a === 'object' && typeof b === 'object') {
      const delta = diffpatcher.diff(a, b)
      const output = c.format(delta)
      const m = `${msg || ``}
------------------ DIFF ----------------------
${output}
--------------------------------------------------`
      const error = new Error(m)
      throw error
    } else {
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
  var s = new Set()
  let fieldType = ''
  const propDef = a.def.schema.props[field]

  if (propDef) {
    fieldType = ' ' + REVERSE_TYPE_INDEX_MAP[propDef.typeIndex]
  }

  for (const result of a) {
    i++
    const current = result[field]

    if (s.has(result.id)) {
      throw new Error(`Duplicate id in sort${fieldType} ` + (msg || ''))
    }

    s.add(result.id)
    if (last !== undefined) {
      if (typeof last === 'string') {
        if (order === 'asc') {
          if (last.localeCompare(current) == 1) {
            throw new Error(
              msg || SORT_ERR_MSG + ` String "${field}"${fieldType}`,
            )
          }
        } else if (last.localeCompare(current) == -1) {
          throw new Error(
            msg || SORT_ERR_MSG + ` String "${field}"${fieldType}`,
          )
        }
      } else {
        if (order === 'asc') {
          if (last > current) {
            throw new Error(
              msg ||
                SORT_ERR_MSG + ` "${field}" ${last} > ${current}${fieldType}`,
            )
            // }
          }
        } else if (last < current) {
          throw new Error(
            msg ||
              SORT_ERR_MSG + ` "${field}" ${last} < ${current}${fieldType}`,
          )
        }
      }
    }
    last = current
  }
  if (i === 0) {
    throw new Error(msg ?? '' + ` isSorted empty result "${field}"${fieldType}`)
  }
}

export const throws = async (
  fn: () => Promise<any>,
  logErr?: string | boolean,
  label?: string,
) => {
  if (typeof logErr === 'string') {
    label = logErr
  }
  var didThrow = false
  try {
    await fn()
  } catch (err) {
    didThrow = true
    const e = new Error('')
    e.stack.split('\n').slice(-1).join('')
    if (logErr == true) {
      console.log('')
      if (label) {
        console.log(color.gray(`${label} "${err.stack}"`))
      } else {
        console.log(color.gray(err.stack))
      }
      console.log('')
    }
  }
  if (didThrow === false) {
    throw new Error(`"${label ?? '   ' + fn.toString()}" should throw`)
  }
}
