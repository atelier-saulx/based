import { Ctx } from '../Ctx.js'
import { CREATE } from '../types.js'
import { type LangCode, type DbPropDef } from '@based/schema'

export const markString = (ctx: Ctx, def: DbPropDef) => {
  if (ctx.operation === CREATE) {
    ctx.schema.separateSort.bufferTmp[def.id] = 2
    ctx.sort++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults.bufferTmp[def.id] = 1
      ctx.defaults++
    }
  }
}

export const markDefaults = (ctx: Ctx, def: DbPropDef, val: any) => {
  if (
    ctx.operation === CREATE &&
    ctx.schema.hasSeperateDefaults &&
    val !== null
  ) {
    if (!ctx.schema.separateDefaults.bufferTmp[def.id]) {
      ctx.schema.separateDefaults.bufferTmp[def.id] = 1
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
  def: DbPropDef,
  locale: LangCode,
  textStringValue: boolean,
) => {
  if (ctx.operation === CREATE) {
    const index = def.id * (1 + ctx.schema.localeSize)
    const langIndex = ctx.schema.separateTextSort.localeToIndex.get(locale)
    ctx.schema.separateTextSort.bufferTmp[index] -= 1
    ctx.schema.separateTextSort.bufferTmp[index + langIndex] = 0
    ctx.sortText++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults.bufferTmp[def.id]++
      if (textStringValue) {
        ctx.defaults++
      }
    }
  }
}
