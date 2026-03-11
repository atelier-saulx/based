import {
  ReaderMeta,
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
import { Ctx, Include, ReadCtx, ReadOpts } from './ast.js'
import { getFallbacks, isLocalized } from './utils.js'

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

const getReaderType = (
  p: PropDef,
  ctx: ReadCtx,
  opts: ReadOpts,
): PropTypeEnum => {
  if (opts.raw) {
    return PropType.binary
  }

  if (
    isLocalized(p.type) &&
    opts.code !== LangCode.none &&
    opts.langs.length === 0
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
    path: p.isEdge ? p.path.slice(1) : p.path,
    type: getReaderType(p, ctx, opts),
    readBy: 0,
  }

  if (opts.meta) {
    if (isLocalized(p.type) && readProp.type !== p.type) {
      if (ctx.locale) {
        const fallBacks =
          ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
        readProp.locales = {}
        for (const lang of fallBacks) {
          readProp.locales[lang] = {
            name: LangCodeInverse[lang],
            meta: false,
          }
        }
      }
    }
    readProp.meta = opts.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
  }

  if ('vals' in p) {
    // @ts-ignore TODO make this nice
    readerPropDef.enum = Array.from(p.vals.keys())
  }

  if (p.type === PropType.vector || p.type === PropType.colVec) {
    // TODO Do something so that this works without ignore
    // @ts-ignore
    readerPropDef.vectorBaseType = VectorBaseType[p.schema.baseType]
    // @ts-ignore
    readerPropDef.len = p.schema.size
  }

  if (
    readProp.type === PropType.jsonLocalized ||
    readProp.type === PropType.stringLocalized
  ) {
    readProp.locales = {}
    if (opts.langs.length > 0) {
      for (const lang of opts.langs) {
        readProp.locales[lang.code] = {
          name: LangCodeInverse[lang.code],
          meta: false,
        }
      }
    } else {
      for (const lang in ctx.locales) {
        readProp.locales[lang] = {
          name: ctx.locales[lang],
          meta: false,
        }
      }
    }
  }

  return readProp
}
