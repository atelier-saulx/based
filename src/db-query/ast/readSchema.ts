import {
  ReaderMeta,
  ReaderPropDef,
  ReaderSchema,
  ReaderSchemaEnum,
} from '../../protocol/index.js'
import { PropDef } from '../../schema/defs/index.js'
import {
  LangCode,
  LangCodeInverse,
  PropType,
  VectorBaseType,
} from '../../zigTsExports.js'
import { Ctx, Include, ReadCtx, ReadOpts } from './ast.js'
import { getFallbacks, isLocalized } from './utils.js'

export const readSchema = (type?: ReaderSchemaEnum): ReaderSchema => {
  return {
    readId: 0,
    props: {},
    search: false,
    main: { len: 0, props: {} },
    refs: {},
    type: type ?? ReaderSchemaEnum.default,
  }
}

const emptyReadOpts: ReadOpts = {
  raw: false,
  meta: false,
  code: LangCode.none,
  langs: [],
}

export const readPropDef = (
  p: PropDef,
  ctx: ReadCtx,
  opts: ReadOpts = emptyReadOpts,
): ReaderPropDef => {
  const readerPropDef: ReaderPropDef = {
    path: p.isEdge ? p.path.slice(1) : p.path,
    typeIndex: opts?.raw ? PropType.binary : p.type,
    readBy: 0,
  }

  if (opts.meta) {
    if (
      isLocalized(p) &&
      opts.code !== LangCode.none &&
      opts.langs.length === 0
    ) {
      readerPropDef.meta =
        opts.meta === 'only'
          ? ReaderMeta.onlyFallback
          : ReaderMeta.combinedFallback
    } else {
      if (opts.langs && opts.langs.find((v) => !v.meta)) {
        readerPropDef.meta =
          opts.meta === 'only'
            ? ReaderMeta.specificLocalesOnly
            : ReaderMeta.specificLocales
        readerPropDef.metaSpecificLangCodes = opts.langs
          .filter((v) => v.meta)
          .map((v) => v.code)
      } else {
        readerPropDef.meta =
          opts.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
      }
    }
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

  // if (p.type === PropType.cardinality) {
  //   readerPropDef.cardinalityMode = p.cardinalityMode
  //   readerPropDef.cardinalityPrecision = p.cardinalityPrecision
  // }

  if (isLocalized(p)) {
    if (opts.langs.length === 0) {
      if (opts.code === LangCode.none) {
        readerPropDef.locales = ctx.locales
      } else if (opts.code === ctx.locale && readerPropDef.meta) {
        readerPropDef.locales = {}
        const fallbacks = getFallbacks(ctx)
        for (const code of fallbacks) {
          readerPropDef.locales[code] = LangCodeInverse[code]
        }
      }
    } else {
      readerPropDef.locales = {}
      for (const lang of opts.langs) {
        readerPropDef.locales[lang.code] = LangCodeInverse[lang.code]
      }
    }
  }

  return readerPropDef
}
