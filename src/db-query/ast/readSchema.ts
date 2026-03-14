import {
  ReadMeta,
  ReadProp,
  ReadSchema,
  ReadSchemaEnum,
} from '../../protocol/index.js'
import { PropDef } from '../../schema/defs/index.js'
import {
  LangCode,
  LangCodeInverse,
  PropType,
  PropTypeEnum,
  VectorBaseType,
} from '../../zigTsExports.js'
import { ReadCtx, ReadOpts } from './ast.js'
import { isLocalized } from './utils.js'

export const readSchema = (type?: ReadSchemaEnum): ReadSchema => {
  return {
    readId: 0,
    props: {},
    search: false,
    main: { len: 0, props: {} },
    refs: {},
    type: type ?? ReadSchemaEnum.default,
  }
}

const emptyReadOpts: ReadOpts = {
  raw: false,
  meta: false,
  code: LangCode.none,
  langs: [],
}

const getReadMeta = (opts: ReadOpts) => {
  return opts.meta === 'only'
    ? ReadMeta.only
    : opts.meta
      ? ReadMeta.combined
      : undefined
}

const getReadType = (p: PropDef, opts: ReadOpts): PropTypeEnum => {
  if (opts.raw) {
    return PropType.binary
  }
  if (
    isLocalized(p.type) &&
    opts.code !== LangCode.none &&
    !opts.langs?.length
  ) {
    return p.type === PropType.jsonLocalized ? PropType.json : PropType.string
  }
  return p.type
}

export const readPropDef = (
  p: PropDef,
  ctx: ReadCtx,
  opts: ReadOpts = emptyReadOpts,
): ReadProp => {
  const readProp: ReadProp = {
    //     path: p.isEdge ? p.path.slice(1) : p.path,
    path: p.path,
    type: getReadType(p, opts),
    readBy: 0,
  }

  if (opts.meta && !isLocalized(readProp.type)) {
    if (isLocalized(p.type)) {
      if (ctx.locale) {
        const fallBacks =
          ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
        readProp.locales = {}
        for (const lang of fallBacks) {
          readProp.locales[lang] = {
            name: LangCodeInverse[lang],
            readBy: 0,
          }
        }
      }
    }
    readProp.meta = getReadMeta(opts)
  }

  if ('vals' in p) {
    // @ts-ignore TODO make this nice
    readProp.enum = Array.from(p.vals.keys())
  }

  if (p.type === PropType.vector || p.type === PropType.colVec) {
    const baseType = (readProp.vectorBaseType =
      // @ts-ignore TODO make this nice
      VectorBaseType[p.schema.baseType])
    // @ts-ignore TODO make this nice
    readProp.len = p.schema.size
  }

  if (
    readProp.type === PropType.jsonLocalized ||
    readProp.type === PropType.stringLocalized
  ) {
    readProp.locales = {}
    if (opts.langs!.length > 0) {
      for (const lang of opts.langs!) {
        readProp.locales[lang.code] = {
          name: LangCodeInverse[lang.code],
          meta: getReadMeta(lang),
          readBy: 0,
        }
      }
    } else {
      for (const lang in ctx.locales) {
        readProp.locales[lang] = {
          name: ctx.locales[lang],
          meta: getReadMeta(opts),
          readBy: 0,
        }
      }
    }
  }

  return readProp
}
