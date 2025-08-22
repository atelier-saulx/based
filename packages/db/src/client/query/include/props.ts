import {
  BINARY,
  JSON,
  ALIAS,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
} from '@based/schema/def'
import { MainMetaInclude, QueryDef, QueryDefType } from '../types.js'

export const getAll = (props: QueryDef['props']): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex !== REFERENCE && prop.typeIndex !== REFERENCES) {
      fields.push(prop.path.join('.'))
    }
  }
  return fields
}

export const getAllRefs = (props: QueryDef['props'], affix = ''): string[] => {
  const fields: string[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
      const refPath = prop.path.join('.') + affix
      fields.push(refPath)

      if (prop.edges) {
        for (const edge in prop.edges) {
          fields.push(refPath + '.' + edge)
        }
      }
    }
  }
  return fields
}

export const includeField = (def: QueryDef, field: string) => {
  if (field === '*') {
    if (
      def.type === QueryDefType.Reference ||
      def.type === QueryDefType.References
    ) {
      const fields: string[] = []
      if (def.target.propDef.edges) {
        for (const edge in def.target.propDef.edges) {
          fields.push(edge)
        }
      }
      includeFields(def, fields)
    }
    includeFields(def, getAll(def.props))
  } else if (field === '**') {
    includeFields(def, getAllRefs(def.props))
  } else if (field.startsWith('**.')) {
    includeFields(def, getAllRefs(def.props, field.substring(2)))
  } else {
    // def.schema.hooks?.include?.(def.)
    def.include.stringFields.add(field)
  }
}

export const includeFields = (def: QueryDef, fields: string[]) => {
  for (const field of fields) {
    includeField(def, field)
  }
}

export const includeAllProps = (def: QueryDef) => {
  for (const key in def.props) {
    const prop = def.props[key]
    if (prop.typeIndex !== REFERENCE && prop.typeIndex !== REFERENCES) {
      includeProp(def, prop)
    }
  }
}

export const includeProp = (def: QueryDef, prop: PropDef | PropDefEdge) => {
  if (!prop || prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
    return false
  }

  if (prop.typeIndex === TEXT) {
    if (!def.include.langTextFields.has(prop.prop)) {
      def.include.langTextFields.set(prop.prop, {
        def: prop,
        codes: new Set(),
        fallBacks: [],
      })
    }
    const langs = def.include.langTextFields.get(prop.prop)
    if (def.lang.fallback.length > 0) {
      for (const fallback of def.lang.fallback) {
        if (!langs.fallBacks.includes(fallback)) {
          langs.fallBacks.push(fallback)
        }
      }
    }
    const langCode = def.lang.lang ?? 0
    langs.codes.add(langCode)
    if (langCode === 0 || langs.codes.size > 1) {
      langs.fallBacks = []
    }
  } else {
    if (prop.separate) {
      def.include.props.set(prop.prop, prop)
    } else {
      if (def.include.metaMain?.has(prop.start)) {
        def.include.metaMain.set(prop.start, MainMetaInclude.All)
      }
      def.include.main.len += prop.len
      def.include.main.include[prop.start] = [0, prop as PropDef]
      return true
    }
  }
  return false
}
