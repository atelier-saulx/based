import { Item, Meta, ReaderPropDef } from './types.js'

export const addLangProp = (
  p: ReaderPropDef,
  value: any,
  item: Item,
  lang: number,
) => {
  let i = 0
  const path = p.path
  let langs: { [lang: string]: string }
  const len = path.length
  let select: any = item
  for (; i < len; i++) {
    const field = path[i]
    if (i === len - 1) {
      if (!(field in select)) {
        select[field] = langs = {}
        for (const lang in p.locales) {
          const str = p.locales[lang]
          langs[str] = ''
        }
      } else {
        langs = select[field]
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
  langs[p.locales[lang]] = value
}

export const addProp = (p: ReaderPropDef, value: any, item: Item) => {
  let i = 0
  const path = p.path
  const len = path.length
  let select: any = item
  for (; i < len; i++) {
    const field = path[i]
    if (i === len - 1) {
      if (p.meta) {
        if (!select[field]) {
          select[field] = {}
        }
        select[field].value = value
      } else {
        select[field] = value
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}

export const addMetaProp = (p: ReaderPropDef, meta: Meta, item: Item) => {
  let i = 0
  const path = p.path
  const len = path.length
  let select: any = item
  for (; i < len; i++) {
    const field = path[i]
    if (i === len - 1) {
      if (select[field]) {
        meta.value = select[field].value
        select[field] = meta
      } else {
        select[field] = meta
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}
