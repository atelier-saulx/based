import {
  STRING,
  JSON,
  BINARY,
  CARDINALITY,
  REFERENCES,
  REFERENCE,
  VECTOR,
  TEXT,
  ALIAS,
} from '@based/schema/def'
import { Item, Meta, ReaderMeta, ReaderPropDef, ReaderSchema } from './types.js'
import { addLangMetaProp, addMetaProp, addProp } from './addProps.js'
import { readVector } from './vector.js'
import { emptyMeta } from './meta.js'

const undefinedValue = (prop: ReaderPropDef) => {
  const typeIndex = prop.typeIndex
  if (typeIndex === STRING || typeIndex === ALIAS) {
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
      p.readBy = q.readId
      if (p.meta) {
        if (p.typeIndex === TEXT && p.locales) {
          for (const code in p.locales) {
            const meta = emptyMeta()
            if (p.meta === ReaderMeta.combined) {
              meta.value = ''
            }
            addLangMetaProp(p, meta, item, Number(code))
          }
        } else {
          const meta = emptyMeta()
          if (p.meta === ReaderMeta.combined) {
            meta.value = undefinedValue(p)
          }
          addMetaProp(p, meta, item)
        }
      } else {
        addProp(p, undefinedValue(p), item)
      }
    }
  }
}
