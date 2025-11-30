import { IncludeOpts, type QueryDef } from '../types.js'
import { BranchInclude, QueryBranch } from '../BasedDbQuery.js'
import { includeField } from './props.js'
import { createOrGetRefQueryDef } from './utils.js'

export const include = (
  query: QueryBranch<any>,
  fields: (string | BranchInclude | IncludeOpts | (string | IncludeOpts)[])[],
) => {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const next = fields[i + 1]
    const opts = typeof next === 'object' ? (next as IncludeOpts) : undefined
    const def = query.def as QueryDef
    if (opts) {
      i++
    }

    if (typeof f === 'string') {
      includeField(def, { field: f, opts })
    } else if (typeof f === 'function') {
      f((field: string) => {
        if (field[0] === '$') {
          console.warn('TODO edge stuff here')
          throw Error('not implemented')
          // const prop = def.target?.propDef?.edges[field]
          // if (
          //   prop &&
          //   (prop.type === 'reference' || prop.type === 'references')
          // ) {
          //   const refDef = createOrGetEdgeRefQueryDef(query.db, def, prop)
          //   return new QueryBranch(query.db, refDef)
          // }
          // throw new Error(
          //   `No edge reference or edge references field named "${field}"`,
          // )
        } else {
          const prop = def.props[field]
          if (
            prop &&
            (prop.type === 'reference' || prop.type === 'references')
          ) {
            const refDef = createOrGetRefQueryDef(query.db, def, prop)
            return new QueryBranch(query.db, refDef)
          }
          throw new Error(`No reference or references field named "${field}"`)
        }
      })
    } else if (Array.isArray(f)) {
      if (f.length === 0) {
        includeField(def, { field: 'id', opts })
      } else {
        include(query, f)
      }
    } else if (f !== undefined) {
      throw new Error(
        'Invalid include statement: expected props, refs and edges (string or array) or function',
      )
    }
  }
}
