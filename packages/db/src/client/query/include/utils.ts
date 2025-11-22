import { DbClient } from '../../index.js'
import { createQueryDef } from '../queryDef.js'
import {
  IncludeOpts,
  QueryDef,
  QueryDefType,
  ReferenceSelectValue,
} from '../types.js'
import {
  inverseLangMap,
  LangCode,
  langCodesMap,
  type BranchDef,
  type QueryPropDef,
  type PropDef,
  type RefPropDef,
} from '@based/schema'

export const getAllFieldFromObject = (tree: BranchDef, arr: string[] = []) => {
  for (const key in tree.props) {
    const leaf = tree.props[key]
    if ('props' in leaf) {
      getAllFieldFromObject(leaf, arr)
    } else {
      arr.push(leaf.path.join('.'))
    }
  }
  return arr
}

const createRefQueryDef = (
  db: DbClient,
  def: QueryDef,
  t: RefPropDef,
  refSelect?: ReferenceSelectValue,
) => {
  const defRef = createQueryDef(
    db,
    t.type === 'reference' ? QueryDefType.Reference : QueryDefType.References,
    {
      type: t.target.typeDef.name, //t.inverseTypeName,
      propDef: t,
    },
    def.skipValidation,
  )
  defRef.lang = def.lang
  def.references.set(t.id, defRef)
  return defRef
}

export const createOrGetRefQueryDef = (
  db: DbClient,
  def: QueryDef,
  t: RefPropDef,
  refSelect?: ReferenceSelectValue,
) => {
  let refDef = def.references.get(t.id)
  if (!refDef) {
    refDef = createRefQueryDef(db, def, t, refSelect)
  }
  return refDef
}

// export const createOrGetEdgeRefQueryDef = (
//   db: DbClient,
//   def: QueryDef,
//   t: PropDefEdge,
// ) => {
//   def.edges ??= createQueryDef(
//     db,
//     QueryDefType.Edge,
//     {
//       ref: t,
//     },
//     def.skipValidation,
//   )
//   def.edges.props ??= {}
//   def.edges.props[t.name] = t
//   const refDef = createOrGetRefQueryDef(db, def.edges, t)
//   return refDef
// }

export const getEnd = (opts?: IncludeOpts, lang?: LangCode): number => {
  if (!opts || !opts.end) {
    return 0
  }
  if (typeof opts.end === 'object') {
    if (lang) {
      return opts.end[inverseLangMap.get(lang)] ?? opts.end[0] ?? undefined
    }
    return opts.end[0] ?? undefined
  }
  return opts.end
}
