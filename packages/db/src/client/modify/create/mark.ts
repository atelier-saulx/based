import type { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { CREATE } from '../types.ts'
import type { LangCode } from '@based/schema'

export const markString = (ctx: Ctx, def: PropDef) => {
  if (ctx.operation === CREATE) {
    ctx.schema.separateSort.bufferTmp[def.prop] = 2
    ctx.sort++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults.bufferTmp[def.prop] = 1
      ctx.defaults++
    }
  }
}

export const markDefaults = (ctx: Ctx, def: PropDef, val: any) => {
  if (
    ctx.operation === CREATE &&
    ctx.schema.hasSeperateDefaults &&
    val !== null
  ) {
    if (!ctx.schema.separateDefaults.bufferTmp[def.prop]) {
      ctx.schema.separateDefaults.bufferTmp[def.prop] = 1
      ctx.defaults++
    }
  }
}

export const markTextObj = (ctx: Ctx) => {
  if (ctx.operation === CREATE && ctx.schema.hasSeperateDefaults) {
    ctx.defaults++
  }
}

export const markTextValue = (
  ctx: Ctx,
  def: PropDef,
  locale: LangCode,
  textStringValue: boolean,
) => {
  if (ctx.operation === CREATE) {
    const index = def.prop * (1 + ctx.schema.localeSize)
    const langIndex = ctx.schema.separateTextSort.localeToIndex.get(locale)
    ctx.schema.separateTextSort.bufferTmp[index] -= 1
    ctx.schema.separateTextSort.bufferTmp[index + langIndex] = 0
    ctx.sortText++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults.bufferTmp[def.prop]++
      if (textStringValue) {
        ctx.defaults++
      }
    }
  }
}
