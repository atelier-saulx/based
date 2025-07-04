import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  SchemaPropTree,
} from '@based/schema/def'
import { DbClient } from '../../index.js'
import { createQueryDef } from '../queryDef.js'
import { QueryDef, QueryDefType } from '../types.js'

export const getAllFieldFromObject = (
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
  db: DbClient,
  def: QueryDef,
  t: PropDef | PropDefEdge,
) => {
  const defRef = createQueryDef(
    db,
    t.typeIndex === REFERENCE
      ? QueryDefType.Reference
      : QueryDefType.References,
    {
      type: t.inverseTypeName,
      propDef: t,
    },
    def.skipValidation,
  )
  defRef.lang = def.lang
  def.references.set(t.prop, defRef)
  return defRef
}

export const createOrGetRefQueryDef = (
  db: DbClient,
  def: QueryDef,
  t: PropDef | PropDefEdge,
) => {
  if (!def.references.has(t.prop)) {
    return createRefQueryDef(db, def, t)
  }
  return def.references.get(t.prop)
}

export const createOrGetEdgeRefQueryDef = (
  db: DbClient,
  def: QueryDef,
  t: PropDefEdge,
) => {
  def.edges ??= createQueryDef(
    db,
    QueryDefType.Edge,
    {
      ref: t,
    },
    def.skipValidation,
  )
  def.edges.props ??= {}
  def.edges.props[t.name] = t
  const refDef = createOrGetRefQueryDef(db, def.edges, t)
  return refDef
}
