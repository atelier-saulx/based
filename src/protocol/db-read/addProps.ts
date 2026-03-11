import { Item, Meta, ReadMeta, ReadProp } from './types.js'

export const addProp = (
  p: ReadProp,
  value: any,
  item: Item,
  lang?: string,
  meta = p.meta,
) => {
  const path = lang ? [...p.path, lang] : p.path
  const len = path.length - 1
  let select: any = item
  for (let i = 0; i <= len; i++) {
    const field = path[i]
    if (i === len) {
      if (meta) {
        select[field].value = value
      } else {
        select[field] = value
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}

export const addMetaProp = (
  p: ReadProp,
  metaValue: Meta,
  item: Item,
  lang?: string,
  meta = p.meta,
) => {
  const path = lang ? [...p.path, lang] : p.path
  const len = path.length - 1
  let select: any = item
  for (let i = 0; i <= len; i++) {
    const field = path[i]
    if (i === len) {
      select[field] = metaValue
      if (meta === ReadMeta.combined) {
        metaValue.value = ''
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}
