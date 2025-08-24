import { Item, ReaderPropDef } from './types.js'

export const addLangProp = (
  p: ReaderPropDef,
  value: any, // is meta or something
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
      if (!(field in select)) {
        select[field] = value
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
}
