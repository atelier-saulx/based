import {
  ReaderMeta,
  ReaderSchemaEnum,
  type ReaderLocales,
  type ReaderPropDef,
  type ReaderSchema,
} from '../../protocol/index.js'
import { SchemaOut } from '../../schema.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../schema/defs/index.js'
import { LangCode, PropType } from '../../zigTsExports.js'
import { Include, IncludeCtx, QueryAst } from '../ast.js'

export const readPropDef = (
  p: PropDef,
  locales: ReaderLocales,
  include?: Include,
): ReaderPropDef => {
  const readerPropDef: ReaderPropDef = {
    path: p.isEdge ? p.path.slice(1) : p.path,
    typeIndex: include?.raw ? PropType.binary : p.type,
    readBy: 0,
  }
  // if (opts?.meta) {
  //   if (opts?.codes?.size === 1 && opts.codes.has(opts.localeFromDef!)) {
  //     readerPropDef.meta =
  //       opts?.meta === 'only'
  //         ? ReaderMeta.onlyFallback
  //         : ReaderMeta.combinedFallback
  //   } else {
  //     readerPropDef.meta =
  //       opts?.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
  //   }
  // }
  if (p.type === PropType.enum) {
    // console.log(p)
    // readerPropDef.enum = p.prop.enum
  }
  // if (p.type === PropType.vector || p.type === PropType.colVec) {
  //   readerPropDef.vectorBaseType = p.vectorBaseType
  //   readerPropDef.len = p.len
  // }
  // if (p.type === PropType.cardinality) {
  //   readerPropDef.cardinalityMode = p.cardinalityMode
  //   readerPropDef.cardinalityPrecision = p.cardinalityPrecision
  // }
  // if (p.type === PropType.text && opts?.codes) {
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
  //       // dont add locales - interpets it as a normal prop
  //     } else {
  //       readerPropDef.locales = {}
  //       for (const code of opts.codes) {
  //         readerPropDef.locales[code] = LangCodeInverse[code]
  //       }
  //     }
  //   }
  // }
  return readerPropDef
}
