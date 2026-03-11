import { Item, Meta, ReadMeta, ReadProp } from './types.js'

export const addProp = (p: ReadProp, value: any, item: Item, lang?: string) => {
  const path = lang ? [...p.path, lang] : p.path
  const len = path.length - 1
  let select: any = item
  for (let i = 0; i <= len; i++) {
    const field = path[i]
    if (i === len) {
      if (p.meta) {
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
  meta: Meta,
  item: Item,
  lang?: string,
) => {
  const path = lang ? [...p.path, lang] : p.path
  const len = path.length - 1
  let select: any = item
  for (let i = 0; i <= len; i++) {
    const field = path[i]
    if (i === len) {
      select[field] = meta
      if (p.meta === ReadMeta.combined) {
        meta.value = ''
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}
