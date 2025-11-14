import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  SchemaPropTree,
} from '@based/schema/def'
import { DbClient } from '../../index.js'
import { createQueryDef } from '../queryDef.js'
import {
  IncludeOpts,
  QueryDef,
  QueryDefType,
  ReferenceSelectValue,
} from '../types.js'
import { inverseLangMap, LangCode, langCodesMap } from '@based/schema'
import { ref } from 'node:process'

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
  refSelect?: ReferenceSelectValue,
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
  refSelect?: ReferenceSelectValue,
) => {
  let refDef = def.references.get(t.prop)
  if (!refDef) {
    refDef = createRefQueryDef(db, def, t, refSelect)
  }
  return refDef
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
