import { LangCodeEnum } from '../../zigTsExports.js'
// import { emptyMeta } from './meta.js'
import { Item, Meta, ReaderMeta, ReaderPropDef } from './types.js'

export const addLangProp = (
  p: ReaderPropDef,
  value: any,
  item: Item,
  lang: number,
) => {
  const path = p.path
  let langs: { [lang: string]: any } | undefined
  const len = path.length - 1
  let select: any = item
  for (let i = 0; i <= len; i++) {
    const field = path[i]
    if (i === len) {
      if (!(field in select)) {
        select[field] = langs = {}
        for (const lang in p.locales) {
          const str = p.locales[lang].name
          langs[str] = ''
        }
      } else {
        langs = select[field]
      }
    } else {
      select = select[field] ?? (select[field] = {})
    }
  }
  console.info({ x: p.locales![lang] })
  langs![p.locales![lang].name] = value
}

export const addProp = (p: ReaderPropDef, value: any, item: Item) => {
  const path = p.path
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
