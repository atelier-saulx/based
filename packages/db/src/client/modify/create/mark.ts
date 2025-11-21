import { Ctx } from '../Ctx.js'
import { CREATE } from '../types.js'
import { type LangCode, type LeafDef } from '@based/schema'

export const markString = (ctx: Ctx, def: LeafDef) => {
  if (ctx.operation === CREATE) {
    ctx.typeDef.separateSort.bufferTmp[def.id] = 2
    ctx.sort++
    if (ctx.typeDef.hasSeperateDefaults) {
      ctx.typeDef.separateDefaults.bufferTmp[def.id] = 1
      ctx.defaults++
    }
  }
}

export const markDefaults = (ctx: Ctx, def: LeafDef, val: any) => {
  if (
    ctx.operation === CREATE &&
    ctx.typeDef.hasSeperateDefaults &&
    val !== null
  ) {
    if (!ctx.typeDef.separateDefaults.bufferTmp[def.id]) {
      ctx.typeDef.separateDefaults.bufferTmp[def.id] = 1
      ctx.defaults++
    }
  }
}

export const markTextObj = (ctx: Ctx) => {
  if (ctx.operation === CREATE && ctx.typeDef.hasSeperateDefaults) {
    ctx.defaults++
  }
}

export const markTextValue = (
  ctx: Ctx,
  def: LeafDef,
  locale: LangCode,
  textStringValue: boolean,
) => {
  if (ctx.operation === CREATE) {
    const index = def.id * (1 + ctx.typeDef.localeSize)
    const langIndex = ctx.typeDef.separateTextSort.localeToIndex.get(locale)
    ctx.typeDef.separateTextSort.bufferTmp[index] -= 1
    ctx.typeDef.separateTextSort.bufferTmp[index + langIndex] = 0
    ctx.sortText++
    if (ctx.typeDef.hasSeperateDefaults) {
      ctx.typeDef.separateDefaults.bufferTmp[def.id]++
      if (textStringValue) {
        ctx.defaults++
      }
    }
  }
}
