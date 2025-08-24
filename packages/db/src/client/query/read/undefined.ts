import {
  STRING,
  JSON,
  TypeIndex,
  BINARY,
  CARDINALITY,
  REFERENCES,
  REFERENCE,
  VECTOR,
  PropDefEdge,
  PropDef,
  TEXT,
} from '@based/schema/def'
import { QueryDef } from '../types.js'
import { Item, ReaderPropDef, ReaderSchema } from './types.js'
import { addProp } from './addProps.js'
import { readVector } from './readVector.js'

const undefinedValue = (prop: ReaderPropDef) => {
  const typeIndex = prop.typeIndex
  if (typeIndex === STRING) {
    return ''
  }
  if (typeIndex === JSON) {
    return null
  }
  if (typeIndex === BINARY) {
    return new Uint8Array()
  }
  if (typeIndex === CARDINALITY) {
    return 0
  }
  if (typeIndex === REFERENCES) {
    return []
  }
  if (typeIndex === REFERENCE) {
    return null
  }
  if (typeIndex === VECTOR) {
    return readVector(prop, new Uint8Array())
  }
  if (typeIndex === TEXT) {
    if (prop.locales) {
      const codes = {}
      for (const code in prop.locales) {
        codes[prop.locales[code]] = ''
      }
      return codes
    } else {
      return ''
    }
  }
  return undefined
}

export const undefinedProps = (q: ReaderSchema, item: Item) => {
  for (const k in q.props) {
    const p = q.props[k]
    if (p.readBy !== q.readId) {
      addProp(p, undefinedValue(p), item)
      //   const prop = q.schema.reverseProps[k]
      // handle edge
      // Only relevant for seperate props
      //   const prop = q.schema.reverseProps[k]
      //   if (prop.typeIndex === CARDINALITY) {
      //     addProp(prop, 0, item)
      //   } else if (prop.typeIndex === TEXT && q.lang.lang == 0) {
      //     const lan = getEmptyField(prop, item)
      //     const lang = q.include.langTextFields.get(prop.prop).codes
      //     if (lang.has(0)) {
      //       for (const locale in q.schema.locales) {
      //         if (lan[locale] == undefined) {
      //           lan[locale] = ''
      //         }
      //       }
      //     } else {
      //       for (const code of lang) {
      //         const locale = inverseLangMap.get(code)
      //         if (!lan[locale]) {
      //           lan[locale] = ''
      //         }
      //       }
      //     }
      // } else {
      //   // selvaStringProp(q, prop, item)
      // }
    }
  }
}
