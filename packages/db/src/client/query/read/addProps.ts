import { PropDef, PropDefEdge } from '@based/schema/def'
import { Item } from './types.js'
import { inverseLangMap } from '@based/schema'
import { QueryDef } from '../types.js'

export const addProp = (
  q: QueryDef,
  p: PropDef | PropDefEdge,
  value: any,
  item: Item,
  lang: number = 0,
  lastField: string | false = false,
) => {
  // will use q to handle META
  if (p.transform) {
    value = p.transform('read', value)
  }
  let i = p.__isEdge === true ? 1 : 0
  const path = lastField
    ? [...p.path, lastField]
    : lang
      ? [...p.path, inverseLangMap.get(lang)]
      : p.path
  const len = path.length
  if (len - i === 1) {
    const field = path[i]
    if (!(field in item)) {
      item[field] = value
    }
  } else {
    let select: any = item
    for (; i < len; i++) {
      const field = path[i]
      if (i === len - 1) {
        if (!(field in select)) {
          select[field] = value
        }
      } else {
        select = select[field] ?? (select[field] = {})
      }
    }
  }
}
