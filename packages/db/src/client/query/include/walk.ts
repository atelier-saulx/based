import { BasedDb } from '../../../index.js'
import {
  isPropDef,
  PropDef,
  REFERENCE,
  REFERENCES,
  SchemaPropTree,
} from '../../../server/schema/types.js'
import { createQueryDef } from '../queryDef.js'
import { isRefDef, QueryDef, QueryDefType } from '../types.js'
import { getAllFieldFromObject, createOrGetRefQueryDef } from './utils.js'
import { includeFields, includeProp, includeAllProps } from './props.js'
import { DbClient } from '../../index.js'

export const walkDefs = (db: DbClient, def: QueryDef, f: string) => {
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
        if (
          edgeProp.typeIndex === REFERENCE ||
          edgeProp.typeIndex === REFERENCES
        ) {
          const refDef = createOrGetRefQueryDef(db, def.edges, edgeProp)
          if (path.length - 1 === i) {
            includeAllProps(refDef)
          } else {
            const f = path.slice(i + 1).join('.')
            if (!includeProp(refDef, refDef.props[f])) {
              includeFields(refDef, [f])
            }
            return
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
      if (
        isPropDef(t) &&
        (t.typeIndex === REFERENCE || t.typeIndex === REFERENCES)
      ) {
        const refDef = createOrGetRefQueryDef(db, def, t)
        const f = path.slice(i + 1).join('.')
        if (!includeProp(refDef, refDef.props[f])) {
          includeFields(refDef, [f])
        }
        return
      }
    }
    const tree = def.schema.tree[path[0]]
    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        walkDefs(db, def, field)
      }
    }
  } else if (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
    const refDef = createOrGetRefQueryDef(db, def, prop)
    includeAllProps(refDef)
    return
  } else {
    includeProp(def, prop)
  }
}
