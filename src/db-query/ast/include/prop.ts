import { PropDef } from '../../../schema/defs/index.js'
import { isEmptyObject } from '../../../utils/isEmptyObject.js'
import {
  IncludeOp,
  LangCodeEnum,
  PropType,
  pushIncludeHeader,
  pushIncludeOpts,
  writeIncludeHeaderProps,
} from '../../../zigTsExports.js'
import { Ctx, Include } from '../ast.js'
import { readPropDef } from '../readSchema.js'

export const includeProp = (ctx: Ctx, prop: PropDef, include: Include[]) => {
  const isLocalized =
    prop.type === PropType.jsonLocalized ||
    prop.type === PropType.stringLocalized

  const offset = pushIncludeHeader(ctx.query, {
    op: IncludeOp.default,
    prop: prop.id,
    propType: prop.type,
  })

  for (let i = 0; i < include.length; i++) {
    const opts = include[i]
    if (opts.meta !== 'only') {
      if (!isEmptyObject(opts)) {
        writeIncludeHeaderProps.op(
          ctx.query.data,
          IncludeOp.defaultWithOpts,
          offset,
        )
        // Todo opts.fall can add custom fallbacks as option
        const fallBacks = opts.langCode ? [] : ctx.localeFallbacks[ctx.locale]
        pushIncludeOpts(ctx.query, {
          hasNextOpt: !!include[i + 1],
          end: opts.maxChars ? opts.maxChars : (opts.maxBytes ?? 0),
          isChars: !!opts.maxChars,
          lang: opts.langCode ?? (isLocalized ? ctx.locale : 0),
          langFallbackSize: fallBacks.length,
        })
        for (let i = 0; i < fallBacks.length || 0; i++) {
          ctx.query.push(fallBacks[i])
        }
      } else if (isLocalized && ctx.locale) {
        writeIncludeHeaderProps.op(
          ctx.query.data,
          IncludeOp.defaultWithOpts,
          offset,
        )
        const fallBacks = ctx.localeFallbacks[ctx.locale]
        pushIncludeOpts(ctx.query, {
          hasNextOpt: false,
          end: 0,
          isChars: false,
          lang: ctx.locale, // if it does not have others
          langFallbackSize: fallBacks.length,
        })
        for (let i = 0; i < fallBacks.length || 0; i++) {
          ctx.query.push(fallBacks[i])
        }
      }
    } else {
      //
    }
  }

  // do meta here

  ctx.readSchema.props[prop.id] = readPropDef(
    prop,
    ctx.locale,
    ctx.locales,
    include,
  )
}
