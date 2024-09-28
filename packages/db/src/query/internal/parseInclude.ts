import { BasedDb } from '../../index.js'
import {
  isPropDef,
  PropDef,
  PropDefEdge,
  SchemaPropTree,
} from '../../schema/types.js'
import { createQueryDef } from './queryDef.js'
import { isRefDef, QueryDef, QueryDefType } from './types.js'
import { includeAllProps, includeFields, includeProp } from './props.js'

const getAllFieldFromObject = (
  tree: SchemaPropTree | PropDef,
  arr: string[] = [],
) => {
  for (const key in tree) {
    const leaf = tree[key]
    if (!leaf.typeIndex && !leaf.__isPropDef) {
      getAllFieldFromObject(leaf, arr)
    } else {
      arr.push(leaf.path.join('.'))
    }
  }
  return arr
}

const createRefQueryDef = (
  db: BasedDb,
  def: QueryDef,
  t: PropDef | PropDefEdge,
) => {
  const defRef = createQueryDef(
    db,
    t.typeIndex === 13 ? QueryDefType.Reference : QueryDefType.References,
    {
      type: t.inverseTypeName,
      propDef: t,
    },
  )
  def.references.set(t.prop, defRef)
  return defRef
}

const createOrGetRefQueryDef = (
  db: BasedDb,
  def: QueryDef,
  t: PropDef | PropDefEdge,
) => {
  if (!def.references.has(t.prop)) {
    return createRefQueryDef(db, def, t)
  }
  return def.references.get(t.prop)
}

export const parseInclude = (
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
        if (includeProp(refDef, f)) {
          return
        }
        includeFields(refDef, [f])
        return
      }
    }

    const tree = def.schema.tree[path[0]]

    // object
    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        if (parseInclude(db, def, field, includesMain)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return
  }

  if (prop.typeIndex === 13 || prop.typeIndex === 14) {
    const refDef = createOrGetRefQueryDef(db, def, prop)
    includeAllProps(refDef)
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
