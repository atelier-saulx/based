import { BasedDb } from '../../index.js'
import { PropDef, PropDefEdge, SchemaPropTree } from '../../schema/types.js'
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

export const createOrGetRefQueryDef = (
  db: BasedDb,
  def: QueryDef,
  t: PropDef | PropDefEdge,
) => {
  if (!def.references.has(t.prop)) {
    return createRefQueryDef(db, def, t)
  }
  return def.references.get(t.prop)
}
