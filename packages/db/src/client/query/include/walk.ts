import {
  isPropDef,
  PropDef,
  REFERENCE,
  REFERENCES,
  SchemaPropTree,
  TEXT,
} from '@based/schema/def'
import { createQueryDef } from '../queryDef.js'
import { isRefDef, QueryDef, QueryDefType } from '../types.js'
import { getAllFieldFromObject, createOrGetRefQueryDef } from './utils.js'
import { includeProp, includeAllProps, includeField } from './props.js'
import { DbClient } from '../../index.js'
import { langCodesMap } from '@based/schema'
import { includeDoesNotExist, includeLangDoesNotExist } from '../validation.js'

export const walkDefs = (db: DbClient, def: QueryDef, f: string) => {
  const prop = def.props[f]
  const path = f.split('.')

  if (!prop) {
    let t: PropDef | SchemaPropTree = def.schema.tree
    for (let i = 0; i < path.length; i++) {
      const p = path[i]
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
              includeField(refDef, f)
            }
            return
          }
        } else {
          // use include here
          includeProp(def.edges, edgeProp)
        }
        return
      }
      t = t[p]

      if (!t) {
        if (f != 'id') {
          includeDoesNotExist(def, f)
        }
        return
      }

      if (isPropDef(t) && t.typeIndex === TEXT) {
        const lang = path[path.length - 1]
        const langCode = langCodesMap.get(lang)
        if (!langCode || !db.schema.locales[lang]) {
          includeLangDoesNotExist(def, f)
          return
        }
        if (!def.include.langTextFields.has(t.prop)) {
          def.include.langTextFields.set(t.prop, {
            def: t,
            codes: new Set(),
            fallBacks: [],
          })
        }
        def.include.langTextFields.get(t.prop).codes.add(langCode)
        return
      } else if (
        isPropDef(t) &&
        (t.typeIndex === REFERENCE || t.typeIndex === REFERENCES)
      ) {
        const refDef = createOrGetRefQueryDef(db, def, t)
        const f = path.slice(i + 1).join('.')
        if (!includeProp(refDef, refDef.props[f])) {
          includeField(refDef, f)
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
