import { Item, ReaderMeta, ReaderPropDef, ReaderSchema } from './types.js'
import { addLangMetaProp, addMetaProp, addProp } from './addProps.js'
import { readVector } from './vector.js'
import { emptyMeta } from './meta.js'
import { PropType } from '../zigTsExports.js'

const undefinedValue = (prop: ReaderPropDef) => {
  const typeIndex = prop.typeIndex
  if (typeIndex === PropType.string || typeIndex === PropType.alias) {
    return ''
  }
  if (typeIndex === PropType.json) {
    return null
  }
  if (typeIndex === PropType.binary) {
    return new Uint8Array()
  }
  if (typeIndex === PropType.cardinality) {
    return 0
  }
  if (typeIndex === PropType.references) {
    return []
  }
  if (typeIndex === PropType.reference) {
    return null
  }
  if (typeIndex === PropType.vector) {
    return readVector(prop, new Uint8Array())
  }
  if (typeIndex === PropType.text) {
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
        if (p.typeIndex === PropType.text && p.locales) {
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
