import { BasedDb } from '../../index.js'
import { isPropDef, PropDef, SchemaPropTree } from '../../schema/types.js'
import { createQueryDef } from '../queryDef.js'
import { isRefDef, QueryDef, QueryDefType } from '../types.js'
import { getAllFieldFromObject, createOrGetRefQueryDef } from './utils.js'
import { includeAllProps, includeFields, includeProp } from './props.js'

export const walkDefs = (
  db: BasedDb,
  def: QueryDef,
  f: string,
  includesMain: boolean,
): boolean => {
  const prop = def.props[f]
  const path = f.split('.')

  if (!prop) {
    let t: PropDef | SchemaPropTree = def.schema.tree
    for (let i = 0; i < path.length; i++) {
      const p = path[i]

      if (isRefDef(def) && p[0] == '$') {
        if (!def.edges) {
          def.edges = createQueryDef(db, QueryDefType.Edge, {
            ref: def.target.propDef,
          })
        }
        const edgeProp = def.edges.props[p]
        if (edgeProp.typeIndex === 13 || edgeProp.typeIndex === 14) {
          const refDef = createOrGetRefQueryDef(db, def.edges, edgeProp)
          if (path.length - 1 === i) {
            includeAllProps(refDef)
          } else {
            const f = path.slice(i + 1).join('.')
            if (includeProp(refDef, f)) {
              return
            } else {
              includeFields(refDef, [f])
            }
          }
        } else {
          def.edges.include.props.add(edgeProp.prop)
        }
        return
      }

      t = t[p]
      if (!t) {
        return
      }

      if (isPropDef(t) && (t.typeIndex === 13 || t.typeIndex === 14)) {
        const refDef = createOrGetRefQueryDef(db, def, t)
        const f = path.slice(i + 1).join('.')
        includeFields(refDef, [f])

        // let includeMain = refDef.include.main.len
        // if (walkDefs(db, refDef, f, includesMain)) {
        //   // includesMain = true
        // }
        // if (includeProp(refDef, f)) {
        //   return
        // }
        return
      }
    }

    const tree = def.schema.tree[path[0]]

    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (walkDefs(db, def, field, includesMain)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return
  }

  if (prop.typeIndex === 13 || prop.typeIndex === 14) {
    const refDef = createOrGetRefQueryDef(db, def, prop)
    // includeAllProps(refDef)
    includeFields(refDef, ['*'])
    return
  }

  if (prop.separate) {
    def.include.props.add(prop.prop)
  } else {
    if (!includesMain) {
      includesMain = true
    }
    def.include.main.len += prop.len
    def.include.main.include[prop.start] = [0, prop as PropDef]
    return true
  }
}
