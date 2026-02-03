import type { PropDef, PropTree } from '../../schema/defs/index.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  ModifyIncrement,
  pushModifyMainHeader,
  pushModifyPropHeader,
  writeModifyPropHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
  PropType,
  LangCode,
} from '../../zigTsExports.js'

export const serializeProps = (
  tree: PropTree,
  data: any,
  buf: AutoSizedUint8Array,
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  for (const key in data) {
    const def = tree.get(key)
    if (def === undefined) {
      continue
    }
    const val = data[key]
    if (def.constructor === Map) {
      if (val !== null && typeof val === 'object') {
        serializeProps(def, val, buf, op, lang)
      }
    } else {
      const prop = def as PropDef
      if (prop.id === 0) {
        // main
        const increment = typeof val === 'object' && val?.increment
        pushModifyMainHeader(buf, {
          id: 0,
          start: prop.start,
          type: prop.type,
          increment: increment
            ? increment < 0
              ? ModifyIncrement.decrement
              : ModifyIncrement.increment
            : ModifyIncrement.none,
        })
        if (val === null) {
          buf.fill(0, buf.length, buf.length + prop.size)
        } else {
          prop.pushValue(buf, increment ? Math.abs(increment) : val, op, lang)
        }
      } else {
        // separate
        const index = pushModifyPropHeader(buf, prop)
        if (val !== null) {
          const start = buf.length
          prop.pushValue(buf, val, op, lang)
          writeModifyPropHeaderProps.size(buf.data, buf.length - start, index)
        }
      }
    }
  }
}
