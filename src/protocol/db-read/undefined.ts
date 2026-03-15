import { Item, Meta, ReadMeta, ReadProp, ReadSchema } from './types.js'
import { addMetaProp, addProp } from './addProps.js'
import { readVector } from './vector.js'
import { PropType } from '../../zigTsExports.js'

const undefinedMeta = (): Meta => {
  return {
    checksum: 0,
    size: 0,
    crc32: 0,
    compressed: false,
    compressedSize: 0,
  }
}

const undefinedValue = (prop: ReadProp) => {
  const type = prop.type
  if (
    type === PropType.string ||
    type === PropType.alias ||
    type === PropType.stringLocalized
  ) {
    return ''
  }
  if (
    type === PropType.json ||
    type === PropType.reference ||
    type === PropType.jsonLocalized
  ) {
    return null
  }
  if (type === PropType.binary) {
    return new Uint8Array()
  }
  if (type === PropType.cardinality) {
    return 0
  }
  if (type === PropType.references) {
    return []
  }
  if (type === PropType.vector) {
    return readVector(prop, new Uint8Array())
  }
  return undefined
}

const addUndefinedProp = (
  p: ReadProp,
  item: Item,
  lang?: string,
  meta = p.meta,
) => {
  if (meta === ReadMeta.only) {
    addMetaProp(p, undefinedMeta(), item, lang, meta)
  } else if (meta === ReadMeta.combined) {
    addMetaProp(p, undefinedMeta(), item, lang, meta)
    addProp(p, undefinedValue(p), item, lang, meta)
  } else {
    addProp(p, undefinedValue(p), item, lang, meta)
  }
}

export const undefinedProps = (q: ReadSchema, item: Item) => {
  for (const k in q.props) {
    const p = q.props[k]
    if (
      p.type === PropType.stringLocalized ||
      p.type === PropType.jsonLocalized
    ) {
      for (const langCode in p.locales) {
        const lang = p.locales[langCode]
        if (lang.readBy !== q.readId) {
          lang.readBy = q.readId
          addUndefinedProp(p, item, lang.name, lang.meta)
        }
      }
    } else if (p.readBy !== q.readId) {
      {
        p.readBy = q.readId
        addUndefinedProp(p, item)
      }
    }
  }
}
