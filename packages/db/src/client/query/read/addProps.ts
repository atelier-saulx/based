import { Item, ReaderPropDef } from './types.js'
import { inverseLangMap } from '@based/schema' // remove this

export const addProp = (
  p: ReaderPropDef,
  value: any, // is meta or something
  item: Item,
  lang: number = 0,
) => {
  // will use p to handle META
  // if (p.transform) {
  //   value = p.transform('read', value)
  // }
  let i = 0

  // inversse lang map will go into the prop probably
  const path = lang ? [...p.path, inverseLangMap.get(lang)] : p.path

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
          // if p.hasMeta etc
          // if (p.hasMeta && value)
          select[field] = value
        }
      } else {
        select = select[field] ?? (select[field] = {})
      }
    }
  }
}
