import { Item, ReaderMeta, ReaderPropDef, ReaderSchema } from './types.js'
import { addLangMetaProp, addMetaProp, addProp } from './addProps.js'
import { readVector } from './vector.js'
import { emptyMeta } from './meta.js'
import { typeIndexMap } from '@based/schema'

const undefinedValue = (prop: ReaderPropDef) => {
  const typeIndex = prop.typeIndex
  if (typeIndex === typeIndexMap.string || typeIndex === typeIndexMap.alias) {
    return ''
  }
  if (typeIndex === typeIndexMap.json) {
    return null
  }
  if (typeIndex === typeIndexMap.binary) {
    return new Uint8Array()
  }
  if (typeIndex === typeIndexMap.cardinality) {
    return 0
  }
  if (typeIndex === typeIndexMap.references) {
    return []
  }
  if (typeIndex === typeIndexMap.reference) {
    return null
  }
  if (typeIndex === typeIndexMap.vector) {
    return readVector(prop, new Uint8Array())
  }
  if (typeIndex === typeIndexMap.text) {
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
        if (p.typeIndex === typeIndexMap.text && p.locales) {
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
