import {
  isPropDef,
  PropDef,
  REFERENCE,
  REFERENCES,
  SchemaPropTree,
  TEXT,
} from '@based/schema/def'
import { createQueryDef } from '../queryDef.js'
import { IncludeField, isRefDef, QueryDef, QueryDefType } from '../types.js'
import { getAllFieldFromObject, createOrGetRefQueryDef } from './utils.js'
import { includeProp, includeAllProps, includeField } from './props.js'
import { DbClient } from '../../index.js'
import { langCodesMap } from '@based/schema'
import { includeDoesNotExist, includeLangDoesNotExist } from '../validation.js'

export const walkDefs = (
  db: DbClient,
  def: QueryDef,
  include: IncludeField,
) => {
  const prop = def.props[include.field]
  const path = include.field.split('.')

  if (!prop) {
    let t: PropDef | SchemaPropTree = def.schema.tree
    for (let i = 0; i < path.length; i++) {
      let p = path[i]

      if (isRefDef(def) && p[0] == '$') {
        if (!def.edges) {
          def.edges = createQueryDef(
            db,
            QueryDefType.Edge,
            {
              ref: def.target.propDef,
            },
            def.skipValidation,
          )
          def.edges.lang = def.lang
        }
        const edgeProp = def.edges.props[p]

        if (!edgeProp) {
          includeDoesNotExist(def, include.field)
          return
        }

        if (
          edgeProp.typeIndex === REFERENCE ||
          edgeProp.typeIndex === REFERENCES
        ) {
          const refDef = createOrGetRefQueryDef(db, def.edges, edgeProp)
          if (path.length - 1 === i) {
            includeAllProps(refDef)
          } else {
            const f = path.slice(i + 1).join('.')
            if (!includeProp(refDef, refDef.props[f], include.opts)) {
              includeField(refDef, { field: f, opts: include.opts })
            }
            return
          }
        } else {
          // add text for edges
          includeProp(def.edges, edgeProp, include.opts)
        }
        return
      }
      t = t[p]
      if (!t) {
        if (include.field != 'id') {
          includeDoesNotExist(def, include.field)
        }
        return
      }

      if (isPropDef(t) && t.typeIndex === TEXT) {
        const lang = path[path.length - 1]
        const langCode = langCodesMap.get(lang)
        if (!langCode || !db.schema.locales[lang]) {
          includeLangDoesNotExist(def, include.field)
          return
        }
        if (!def.include.props.has(t.prop)) {
          const opts = include.opts ?? {}
          opts.codes = new Set()
          opts.fallBacks = []

          if (opts.end && typeof opts.end === 'number') {
            opts.end = { [lang]: opts.end }
          }
          def.include.props.set(t.prop, { def: t, opts })
        }

        const opts = def.include.props.get(t.prop).opts

        if (include.opts?.end) {
          if (typeof include.opts?.end === 'number') {
            opts.end[lang] = include.opts?.end
          } else if (typeof opts.end === 'object') {
            opts.end = { ...opts.end, ...include.opts.end }
          }
        }
        opts.codes.add(langCode)
        return
      } else if (
        isPropDef(t) &&
        (t.typeIndex === REFERENCE || t.typeIndex === REFERENCES)
      ) {
        const refDef = createOrGetRefQueryDef(db, def, t)
        const f = path.slice(i + 1).join('.')
        if (!includeProp(refDef, refDef.props[f], include.opts)) {
          includeField(refDef, { field: f, opts: include.opts })
        }
        return
      }
    }

    const tree = def.schema.tree[path[0]]
    if (tree) {
      const endFields = getAllFieldFromObject(tree)
      for (const field of endFields) {
        walkDefs(db, def, { field, opts: include.opts })
      }
    }
  } else if (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
    const refDef = createOrGetRefQueryDef(db, def, prop)
    includeAllProps(refDef, include.opts)
    return
  } else {
    includeProp(def, prop, include.opts)
  }
}
