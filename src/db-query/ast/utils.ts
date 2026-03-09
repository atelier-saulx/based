import { PropDef } from '../../schema/defs/index.js'
import { PropType } from '../../zigTsExports.js'
import { ReadCtx } from './ast.js'

export const isLocalized = (prop: PropDef) => {
  return (
    prop.type === PropType.jsonLocalized ||
    prop.type === PropType.stringLocalized
  )
}

export const getFallbacks = (ctx: ReadCtx) => {
  return ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
}
