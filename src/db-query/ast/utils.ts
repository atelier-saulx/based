import { PropType, PropTypeEnum } from '../../zigTsExports.js'
import { ReadCtx } from './ast.js'

export const isLocalized = (type: PropTypeEnum) => {
  return type === PropType.jsonLocalized || type === PropType.stringLocalized
}

export const getFallbacks = (ctx: ReadCtx) => {
  return ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
}
