import { Ctx } from '../Ctx.js'
import { LangCodeEnum, ModOp } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'

export const markString = (ctx: Ctx, def: PropDef) => {
  if (ctx.operation === ModOp.createProp) {
    ctx.schema.separateSort.bufferTmp[def.prop] = 2
    ctx.sort++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults!.bufferTmp[def.prop] = 1
      ctx.defaults++
    }
  }
}

export const markDefaults = (ctx: Ctx, def: PropDef, val: any) => {
  if (
    ctx.operation === ModOp.createProp &&
    ctx.schema.hasSeperateDefaults &&
    val !== null
  ) {
    if (!ctx.schema.separateDefaults!.bufferTmp[def.prop]) {
      ctx.schema.separateDefaults!.bufferTmp[def.prop] = 1
      ctx.defaults++
    }
  }
}

export const markTextObj = (ctx: Ctx) => {
  if (ctx.operation === ModOp.createProp && ctx.schema.hasSeperateDefaults) {
    ctx.defaults++
  }
}

export const markTextValue = (
  ctx: Ctx,
  def: PropDef,
  locale: LangCodeEnum,
  textStringValue: boolean,
) => {
  if (ctx.operation === ModOp.createProp) {
    const index = def.prop * (1 + ctx.schema.localeSize)
    const langIndex = ctx.schema.separateTextSort.localeToIndex.get(locale)!
    ctx.schema.separateTextSort.bufferTmp[index] -= 1
    ctx.schema.separateTextSort.bufferTmp[index + langIndex] = 0
    ctx.sortText++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults!.bufferTmp[def.prop]++
      if (textStringValue) {
        ctx.defaults++
      }
    }
  }
}
