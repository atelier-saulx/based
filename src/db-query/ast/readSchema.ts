import {
  ReaderLocales,
  ReaderPropDef,
  ReaderSchema,
  ReaderSchemaEnum,
} from '../../protocol/index.js'
import { SchemaOut } from '../../schema/index.js'
import { PropDef } from '../../schema/defs/index.js'
import {
  LangCode,
  LangCodeEnum,
  LangCodeInverse,
  PropType,
  VectorBaseType,
} from '../../zigTsExports.js'
import { Include } from './ast.js'

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

const isRaw = (include?: Include[]): boolean => {
  return (
    include !== undefined && include.length === 1 && include[0].raw === true
  )
}

// add CTX
export const readPropDef = (
  p: PropDef,
  defaultLocale: LangCodeEnum,
  locales: ReaderLocales, // add in ctx
  include?: Include[],
): ReaderPropDef => {
  const readerPropDef: ReaderPropDef = {
    path: p.isEdge ? p.path.slice(1) : p.path,
    typeIndex: isRaw(include) ? PropType.binary : p.type,
    readBy: 0,
  }

  // if (opts?.meta) {
  //   if (opts?.codes?.size === 1 && opts.codes.has(opts.localeFromDef!)) {
  //  > this means get .en without the object
  //     readerPropDef.meta =
  //       opts?.meta === 'only'
  //         ? ReaderMeta.onlyFallback
  //         : ReaderMeta.combinedFallback
  //   } else {
  //     readerPropDef.meta =
  //       opts?.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
  //   }
  // }

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

  if (
    p.type === PropType.stringLocalized ||
    p.type === PropType.jsonLocalized
  ) {
    if (include) {
      // if (include.length === 1) {
      //   // now we can check for meta only
      //   if (include[0].langCode) {
      //     readerPropDef.locales = {}
      //     readerPropDef.locales[include[0].langCode] =
      //       LangCodeInverse[include[0].langCode]
      //   }
      // }
      readerPropDef.locales = {}
      for (const inc of include) {
        if (inc.langCode) {
          readerPropDef.locales[inc.langCode] = LangCodeInverse[inc.langCode]
        }
      }
      // do stuff
    } else if (!defaultLocale) {
      readerPropDef.locales = locales
    }

    // if (p.type === PropType.stringLocalized && opts?.codes) {
    //   readerPropDef.locales = locales

    //   if (opts.codes.has(0)) {
    //     readerPropDef.locales = locales
    //   } else {
    //     if (opts.codes.size === 1 && opts.codes.has(opts.localeFromDef!)) {
    //       if (readerPropDef.meta) {
    //         readerPropDef.locales = {}
    //         for (const code of opts.codes) {
    //           readerPropDef.locales[code] = LangCodeInverse[code]
    //         }
    //         if (opts.fallBacks) {
    //           for (const code of opts.fallBacks) {
    //             readerPropDef.locales[code] = LangCodeInverse[code]
    //           }
    //         }
    //       }
    //       // dont add locales - interprets it as a normal prop
    //     } else {
    //       readerPropDef.locales = {}
    //       for (const code of opts.codes) {
    //         readerPropDef.locales[code] = LangCodeInverse[code]
    //       }
    //     }
    //   }
    // }
  }
  return readerPropDef
}
