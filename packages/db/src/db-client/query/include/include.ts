import { IncludeOpts } from '../types.js'
import { BranchInclude, QueryBranch } from '../BasedDbQuery.js'
import { includeField } from './props.js'
import { createOrGetEdgeRefQueryDef, createOrGetRefQueryDef } from './utils.js'
import { PropType } from '../../../zigTsExports.js'

// TODO: BranchInclude should be now stricted typed no?
export const include = (
  query: QueryBranch<any, any>, // TODO:
  fields: (
    | string
    | BranchInclude<any>
    | IncludeOpts
    | (string | IncludeOpts)[]
  )[],
) => {
  const def = query.def!
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const opts =
      typeof fields[i + 1] === 'object' && typeof fields[i + 1] !== 'function'
        ? (fields[i + 1] as IncludeOpts)
        : undefined

    if (opts) {
      i++
    }

    if (typeof f === 'string') {
      includeField(def, { field: f, opts })
    } else if (typeof f === 'function') {
      f((field: string) => {
        if (field[0] === '$') {
          // @ts-ignore
          const prop = def.target?.propDef?.edges[field]
          if (
            prop &&
            (prop.typeIndex === PropType.reference ||
              prop.typeIndex === PropType.references)
          ) {
            const refDef = createOrGetEdgeRefQueryDef(query.db, def, prop)
            // @ts-ignore
            return new QueryBranch(query.db, refDef)
          }
          throw new Error(
            `No edge reference or edge references field named "${field}"`,
          )
        } else {
          const prop = def.props![field]
          if (
            prop &&
            (prop.typeIndex === PropType.reference ||
              prop.typeIndex === PropType.references)
          ) {
            const refDef = createOrGetRefQueryDef(query.db, def, prop)
            // @ts-ignore
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
