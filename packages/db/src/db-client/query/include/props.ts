import type { PropDef, PropDefEdge } from '../../../schema/index.js'
import { LangCode, LangCodeEnum, PropType } from '../../../zigTsExports.js'
import { IncludeField, IncludeOpts, QueryDef, QueryDefType } from '../types.js'

export const getAll = (
  props: QueryDef['props'],
  opts?: IncludeOpts,
): IncludeField[] => {
  const fields: IncludeField[] = []
  for (const key in props) {
    const prop = props[key]
    if (
      prop.typeIndex !== PropType.reference &&
      prop.typeIndex !== PropType.references
    ) {
      fields.push({ field: prop.path!.join('.'), opts })
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
    if (
      prop.typeIndex === PropType.reference ||
      prop.typeIndex === PropType.references
    ) {
      const refPath = prop.path!.join('.') + affix
      fields.push({ field: refPath, opts })

      if (prop.edges) {
        for (const edge in prop.edges) {
          fields.push({ field: refPath + '.' + edge, opts })
        }
      }
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
      if (def.target.propDef!.edges) {
        for (const edge in def.target.propDef!.edges) {
          fields.push({ field: edge, opts })
        }
      }
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
  for (const key in def.props) {
    const prop = def.props[key]
    if (
      prop.typeIndex !== PropType.reference &&
      prop.typeIndex !== PropType.references
    ) {
      includeProp(def, prop, opts)
    }
  }
}

export const includeProp = (
  def: QueryDef,
  prop: PropDef | PropDefEdge,
  opts?: IncludeOpts,
) => {
  if (
    !prop ||
    prop.typeIndex === PropType.reference ||
    prop.typeIndex === PropType.references
  ) {
    return false
  }

  if (prop.typeIndex === PropType.text) {
    if (!def.include.props.has(prop.prop)) {
      const fallBacks: LangCodeEnum[] = []
      if (def.lang.lang !== LangCode.none) {
        console.log('set fallbacks')
        // let lang = def.lang.lang
        // while (lang) {
        //   const langDef = def.schema?.locales[lang]
        //   console.log({ langDef, lang })
        //   if (langDef.fallback) {
        //     lang = langDef.fallback
        //   } else {
        //     break
        //   }
        // }
      }

      def.include.props.set(prop.prop, {
        def: prop,
        opts: {
          codes: new Set(),
          fallBacks,
          localeFromDef: def.lang.lang,
          ...opts,
        },
      })
    }

    const langs = def.include.props.get(prop.prop)!.opts!
    const langCode = def.lang.lang ?? 0
    langs.codes!.add(langCode)
    if (langCode === 0 || langs.codes!.size > 1) {
      langs.fallBacks = []
    }
  } else {
    if (prop.separate) {
      def.include.props.set(prop.prop, { def: prop, opts })
    } else {
      def.include.main.len += prop.len
      def.include.main.include.set(prop.start!, [0, prop as PropDef, opts!])
      return true
    }
  }
  return false
}
