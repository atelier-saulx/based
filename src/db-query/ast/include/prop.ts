import { PropDef } from '../../../schema/defs/index.js'
import { isEmptyObject } from '../../../utils/isEmptyObject.js'
import {
  IncludeOp,
  LangCodeEnum,
  PropType,
  pushIncludeHeader,
  pushIncludeOpts,
} from '../../../zigTsExports.js'
import { Ctx, Include } from '../ast.js'
import { readPropDef } from '../readSchema.js'

export const includeProp = (
  ctx: Ctx,
  prop: PropDef,
  include: Include | Include[],
) => {
  // check for HAS options

  // if meta only need this IncludeMetaHeader

  // has to handle differently for meta...

  if (!Array.isArray(include)) {
    include = [include]
  }

  let hasOpts = include.length
  let propAdded = false
  let hasSpecificLang = false
  for (const opts of include) {
    if (opts.meta !== 'only') {
      if (isEmptyObject(opts)) {
        hasOpts--
        continue
      }
      if (opts.langCode) {
        propAdded = true
        hasSpecificLang = true
        pushIncludeHeader(ctx.query, {
          op: IncludeOp.defaultWithOpts,
          prop: prop.id,
          propType: prop.type,
        })
        pushIncludeOpts(ctx.query, {
          hasOpts: false,
          end: 0,
          isChars: false,
          lang: opts.langCode,
          langFallbackSize: 0,
        })
      }
    } else {
      // meta time...
    }
  }

  if (
    (prop.type === PropType.jsonLocalized ||
      prop.type === PropType.stringLocalized) &&
    !hasSpecificLang &&
    ctx.locale
  ) {
    pushIncludeHeader(ctx.query, {
      op: IncludeOp.defaultWithOpts,
      prop: prop.id,
      propType: prop.type,
    })
    const fallBacks = ctx.localeFallbacks[ctx.locale]
    pushIncludeOpts(ctx.query, {
      hasOpts: false,
      end: 0,
      isChars: false,
      lang: ctx.locale,
      langFallbackSize: fallBacks.length,
    })
    for (let i = 0; i < fallBacks.length || 0; i++) {
      ctx.query.push(fallBacks[i])
    }
  } else if (!propAdded) {
    pushIncludeHeader(ctx.query, {
      op: IncludeOp.default,
      prop: prop.id,
      propType: prop.type,
    })
  }

  //   if (opts?.meta !== 'only') {
  //         const hasEndOption = !!opts?.end
  //         const codes = opts?.codes
  //         if (codes && !codes.has(0)) {
  //           const fallBacks = createLangFallbacks(opts)
  //           result.push(
  //             createIncludeHeader({
  //               op: IncludeOp.defaultWithOpts,
  //               prop,
  //               propType: propType,
  //             }),
  //           )
  //           let i = 0
  //           for (const code of codes) {
  //             i++
  //             result.push(
  //               createIncludeOpts({
  //                 hasOpts: i !== codes.size,
  //                 end: getEnd(propDef.opts),
  //                 isChars: !propDef.opts?.bytes,
  //                 lang: code,
  //                 langFallbackSize: fallBacks.byteLength,
  //               }),
  //               fallBacks,
  //             )
  //           }
  //         } else if (hasEndOption) {
  //           result.push(
  //             createIncludeHeader({
  //               op: IncludeOp.defaultWithOpts,
  //               prop,
  //               propType: propType,
  //             }),
  //             createIncludeOpts({
  //               hasOpts: false,
  //               end: getEnd(propDef.opts),
  //               isChars:
  //                 !propDef.opts?.bytes &&
  //                 (propType === PropType.json ||
  //                   propType === PropType.string ||
  //                   propType === PropType.text),
  //               lang: LangCode.none,
  //               langFallbackSize: 0,
  //             }),
  //           )
  //         } else {
  //           result.push(
  //             createIncludeHeader({
  //               op: IncludeOp.default,
  //               prop,
  //               propType: propType,
  //             }),
  //           )
  //         }
  //       }
  //     }
  //   }

  ctx.readSchema.props[prop.id] = readPropDef(
    prop,
    ctx.locale,
    ctx.locales,
    hasOpts ? include : undefined,
  )
}
