import {
  isPropDef,
  type PropDef,
  type PropTree,
} from '../../schema/defs/index.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  Modify,
  ModifyIncrement,
  pushModifyMainHeader,
  pushModifyPropHeader,
  writeModifyPropHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
} from '../../zigTsExports.js'

export const serializeProps = (
  tree: PropTree,
  data: any,
  buf: AutoSizedUint8Array,
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  if (op !== Modify.update) {
    for (const key of tree.required) {
      if (!(key in data)) {
        const def = tree.props.get(key)!
        throw new Error(
          `Field ${'path' in def ? def.path.join('.') : key} is required`,
        )
      }
    }
  }
  for (const key in data) {
    const def = tree.props.get(key)
    if (def === undefined) {
      continue
    }
    const val = data[key]
    if (isPropDef(def)) {
      const prop = def as PropDef
      if (prop.id === 0) {
        // main
        const increment = typeof val === 'object' && val?.increment
        pushModifyMainHeader(buf, {
          id: 0,
          start: prop.start,
          type: prop.type,
          size: prop.size,
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
    } else if (typeof val === 'object') {
      if (val === null) {
        const empty = {}
        for (const [key] of def.props) empty[key] = null
        serializeProps(def, empty, buf, op, lang)
      } else {
        serializeProps(def, val, buf, op, lang)
      }
    }
  }
}
