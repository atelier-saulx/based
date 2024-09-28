import { BasedDb } from '../../../index.js'
import {
  isPropDef,
  PropDef,
  PropDefEdge,
  SchemaPropTree,
} from '../../../schema/types.js'
import { createQueryDef } from '../queryDef.js'
import { isRefDef, QueryDef, QueryDefType } from '../types.js'
import { includeAll, includeFields } from './includeFields.js'

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
  def.references.set(
    t.prop,
    createQueryDef(
      db,
      t.typeIndex === 13 ? QueryDefType.Reference : QueryDefType.References,
      {
        type: t.inverseTypeName,
        propDef: t,
      },
    ),
  )
}

export const parseInclude = (
  db: BasedDb,
  def: QueryDef,
  f: string,
  includesMain: boolean,
  //   includeTree: any,
): boolean => {
  const field = def.props[f]
  const path = f.split('.')

  // means does not exist on the schema def
  if (!field) {
    // todo does not work fully nested e.g. with an object in edges { x, y } for example

    if (isRefDef(def) && f[0] == '$') {
      if (!def.edges) {
        def.edges = createQueryDef(db, QueryDefType.Edge, {
          ref: def.target.propDef,
        })
      }
      const edgeProp = def.target.propDef.edges[f]
      def.edges.include.props.add(edgeProp.prop)
      return
    }

    // if (include.fromRef && f[0] == '$') {
    //   const edgeIncludes = createOrGetEdgeIncludeDef(
    //     include.fromRef,
    //     include,
    //     query,
    //   )
    //   edgeIncludes.includeFields.add(f)
    //   return
    // }

    let t: PropDef | SchemaPropTree = def.schema.tree
    for (let i = 0; i < path.length; i++) {
      const p = path[i]

      t = t[p]
      if (!t) {
        return
      }

      // 13: reference
      // 14: references
      if (isPropDef(t) && (t.typeIndex === 13 || t.typeIndex === 14)) {
        if (!def.references.has(t.prop)) {
          createRefQueryDef(db, def, t)
        }
        const refDef = def.references.get(t.prop)
        const field = path.slice(i + 1).join('.')
        includeFields(refDef, [field])
        // addPathToIntermediateTree(t, includeTree, t.path)
        return
      }
    }

    const tree = def.schema.tree[path[0]]

    // means its an object
    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        // includeTree
        if (parseInclude(db, def, field, includesMain)) {
          includesMain = true
        }
      }
      return includesMain
    }
    return
  }

  // tmp format to read stuff later
  //   addPathToIntermediateTree(field, includeTree, field.path)

  if (field.typeIndex === 13 || field.typeIndex === 14) {
    if (!def.references.has(field.prop)) {
      createRefQueryDef(db, def, field)
    }
    const refDef = def.references.get(field.prop)
    includeFields(refDef, includeAll(refDef.props))
    return
  }

  if (field.separate) {
    def.include.props.add(field.prop)
  } else {
    if (!includesMain) {
      includesMain = true
    }
    def.include.main.len += field.len
    def.include.main.include[field.start] = [0, field as PropDef]
    return true
  }
}
