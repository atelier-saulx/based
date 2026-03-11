import { Item, ReaderMeta, ReaderPropDef, ReaderSchema } from './types.js'
import { addProp } from './addProps.js'
import { readVector } from './vector.js'
import { PropType } from '../../zigTsExports.js'

const undefinedValue = (prop: ReaderPropDef) => {
  const typeIndex = prop.type
  if (typeIndex === PropType.string || typeIndex === PropType.alias) {
    return ''
  }
  if (typeIndex === PropType.json || typeIndex === PropType.reference) {
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
  if (typeIndex === PropType.vector) {
    return readVector(prop, new Uint8Array())
  }
  if (typeIndex === PropType.stringLocalized && prop.locales) {
    const codes = {}
    for (const code in prop.locales) {
      // skip for meta
      codes[prop.locales[code].name] = ''
    }
    return codes
  }
  if (typeIndex === PropType.jsonLocalized && prop.locales) {
    const codes = {}
    for (const code in prop.locales) {
      // skip for meta
      codes[prop.locales[code].name] = null
    }
    return codes
  }
  return undefined
}

export const undefinedProps = (q: ReaderSchema, item: Item) => {
  for (const k in q.props) {
    const p = q.props[k]
    if (p.readBy !== q.readId) {
      p.readBy = q.readId
      addProp(p, undefinedValue(p), item)
    }
  }
}
