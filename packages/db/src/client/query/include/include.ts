import { IncludeOpts } from '../types.js'
import { BranchInclude, QueryBranch } from '../BasedDbQuery.js'
import { includeField } from './props.js'
import { createOrGetEdgeRefQueryDef, createOrGetRefQueryDef } from './utils.js'

export const include = (
  query: QueryBranch<any>,
  fields: (string | BranchInclude | IncludeOpts | (string | IncludeOpts)[])[],
) => {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const next = fields[i + 1]
    const opts = typeof next === 'object' ? (next as IncludeOpts) : undefined

    if (opts) {
      i++
    }

    if (typeof f === 'string') {
      includeField(query.def, { field: f, opts })
    } else if (typeof f === 'function') {
      f((field: string) => {
        if (field[0] === '$') {
          const prop = query.def.target?.propDef?.edges[field]
          if (
            prop &&
            (prop.type === 'reference' || prop.type === 'references')
          ) {
            const refDef = createOrGetEdgeRefQueryDef(query.db, query.def, prop)
            return new QueryBranch(query.db, refDef)
          }
          throw new Error(
            `No edge reference or edge references field named "${field}"`,
          )
        } else {
          const prop = query.def.props[field]
          if (
            prop &&
            (prop.type === 'reference' || prop.type === 'references')
          ) {
            const refDef = createOrGetRefQueryDef(query.db, query.def, prop)
            return new QueryBranch(query.db, refDef)
          }
          throw new Error(`No reference or references field named "${field}"`)
        }
      })
    } else if (Array.isArray(f)) {
      if (f.length === 0) {
        includeField(query.def, { field: 'id', opts })
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
