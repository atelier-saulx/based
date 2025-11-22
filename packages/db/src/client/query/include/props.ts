import { getAllProps, type QueryPropDef } from '@based/schema'
import { IncludeField, IncludeOpts, QueryDef, QueryDefType } from '../types.js'

export const getAll = (
  props: QueryDef['props'],
  opts?: IncludeOpts,
): IncludeField[] => {
  const fields: IncludeField[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.type !== 'reference' && prop.type !== 'references') {
      fields.push({ field: prop.path.join('.'), opts })
    }
  }
  return fields
}

export const getAllRefs = (
  props: QueryDef['props'],
  affix = '',
  opts?: IncludeOpts,
): IncludeField[] => {
  const fields: IncludeField[] = []
  for (const key in props) {
    const prop = props[key]
    if (prop.type === 'reference' || prop.type === 'references') {
      const refPath = prop.path.join('.') + affix
      fields.push({ field: refPath, opts })
      console.warn('TODO: edges getAllRefs')
      // if (prop.edges) {
      //   for (const edge in prop.edges) {
      //     fields.push({ field: refPath + '.' + edge, opts })
      //   }
      // }
    }
  }
  return fields
}

export const includeField = (def: QueryDef, include: IncludeField) => {
  const { field, opts } = include
  if (field === '*') {
    if (
      def.type === QueryDefType.Reference ||
      def.type === QueryDefType.References
    ) {
      const fields: IncludeField[] = []
      console.warn('TODO: edges includeField')
      // if ('target' in def.target.propDef && def.target.propDef.edges) {
      //   for (const edge in def.target.propDef.edges) {
      //     fields.push({ field: edge, opts })
      //   }
      // }
      includeFields(def, fields)
    }
    includeFields(def, getAll(def.props, opts))
  } else if (field === '**') {
    includeFields(def, getAllRefs(def.props, '', opts))
  } else if (field.startsWith('**.')) {
    includeFields(def, getAllRefs(def.props, field.substring(2), opts))
  } else {
    def.include.stringFields.set(include.field, include)
  }
}

export const includeFields = (def: QueryDef, fields: IncludeField[]) => {
  for (const field of fields) {
    includeField(def, field)
  }
}

export const includeAllProps = (def: QueryDef, opts?: IncludeOpts) => {
  for (const prop of getAllProps(def.schema)) {
    includeProp(def, prop, opts)
  }
}

export const includeProp = (
  def: QueryDef,
  prop: QueryPropDef,
  opts?: IncludeOpts,
) => {
  if (!prop || prop.type === 'reference' || prop.type === 'references') {
    return false
  }

  if (prop.type === 'text') {
    if (!def.include.props.has(prop.id)) {
      def.include.props.set(prop.id, {
        def: prop,
        opts: {
          codes: new Set(),
          fallBacks: [],
          ...opts,
          localeFromDef: def.lang.lang,
        },
      })
    }

    const langs = def.include.props.get(prop.id)?.opts
    if (langs?.codes && langs.fallBacks) {
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
    }
  } else if ('main' in prop) {
    def.include.main.len += prop.main.size
    def.include.main.include.set(prop.main.start, [
      0,
      prop,
      opts as IncludeOpts,
    ])
    return true
  } else {
    def.include.props.set(prop.id, { def: prop, opts })
  }
  return false
}
