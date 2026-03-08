import { PropDef } from '../../../schema/defs/index.js'
import {
  IncludeOp,
  LangCodeEnum,
  pushIncludeHeader,
} from '../../../zigTsExports.js'
import { Ctx, Include } from '../ast.js'
import { readPropDef } from '../readSchema.js'

// export const createLangFallbacks = (ctx: Ctx) => {
//   const langFallbacks = new Uint8Array(opts.fallBacks!.length || 0)
//   for (let i = 0; i < opts.fallBacks!.length || 0; i++) {
//     langFallbacks[i] = opts.fallBacks![i]
//   }
//   return langFallbacks
// }

export const includeProp = (ctx: Ctx, prop: PropDef, include: Include) => {
  pushIncludeHeader(ctx.query, {
    op: IncludeOp.default,
    prop: prop.id,
    propType: prop.type,
  })
  //   if ctx.locale
  // lang
  ctx.readSchema.props[prop.id] = readPropDef(prop, ctx.locales, include)
}
