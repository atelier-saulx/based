import {
  BINARY,
  STRING,
  isPropDef,
  PropDef,
  REFERENCE,
  REFERENCES,
  SchemaPropTree,
  TEXT,
  JSON,
  ALIAS,
} from '@based/schema/def'
import { createQueryDef } from '../queryDef.js'
import {
  IncludeField,
  isRefDef,
  // MainMetaInclude,
  QueryDef,
  QueryDefType,
} from '../types.js'
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
          // if (
          //   // this can just become OPTS
          //   path[i + 1] === 'meta' &&
          //   (edgeProp.typeIndex === STRING ||
          //     edgeProp.typeIndex === BINARY ||
          //     edgeProp.typeIndex === JSON ||
          //     edgeProp.typeIndex === ALIAS)
          // ) {
          //   if (edgeProp.separate) {
          //     if (!def.edges.include.meta) {
          //       def.edges.include.meta = new Set()
          //     }
          //     def.edges.include.meta.add(edgeProp.prop)
          //   } else {
          //     includeProp(def.edges, edgeProp)
          //     if (!def.edges.include.metaMain) {
          //       def.edges.include.metaMain = new Map()
          //     }
          //     if (!def.edges.include.main.include[edgeProp.start]) {
          //       includeProp(def.edges, edgeProp)
          //       def.edges.include.metaMain.set(
          //         edgeProp.start,
          //         MainMetaInclude.MetaOnly,
          //       )
          //     } else {
          //       def.edges.include.metaMain.set(
          //         edgeProp.start,
          //         MainMetaInclude.All,
          //       )
          //     }
          //   }
          // } else {
          includeProp(def.edges, edgeProp)
          // }
        }
        return
      }

      t = t[p]
      if (!t) {
        if (include.field != 'id') {
          // this can just become OPTS
          // if (include.field.endsWith('.meta')) {
          //   const propPath = include.field.split('.').slice(0, -1).join('.')
          //   const prop = def.props[propPath]
          //   if (
          //     prop &&
          //     (prop.typeIndex === STRING ||
          //       prop.typeIndex === BINARY ||
          //       prop.typeIndex === JSON ||
          //       prop.typeIndex === ALIAS) // later add text
          //   ) {
          //     if (prop.separate) {
          //       if (!def.include.meta) {
          //         def.include.meta = new Set()
          //       }
          //       def.include.meta.add(prop.prop)
          //     } else {
          //       if (!def.include.metaMain) {
          //         def.include.metaMain = new Map()
          //       }
          //       if (!def.include.main.include[prop.start]) {
          //         includeProp(def, prop)
          //         def.include.metaMain.set(prop.start, MainMetaInclude.MetaOnly)
          //       } else {
          //         def.include.metaMain.set(prop.start, MainMetaInclude.All)
          //       }
          //     }
          //   } else {
          //     includeDoesNotExist(def, include.field)
          //     return
          //   }
          // } else {
          includeDoesNotExist(def, include.field)
          // }
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
