import { Ctx } from './ctx.js'
import { makePathBetweenBlocks } from './makePathBetweenBlocks.js'

export const render = (ctx: Ctx) => {
  // -------------- RENDER

  ctx.createCtx()

  if (ctx.backgroundGrid) {
    for (let i = 0; i < ctx.w; i++) {
      let j = 0
      for (let j = 0; j < ctx.h; j++) {
        ctx.canvas.strokeStyle = '#fff'
        ctx.canvas.fillStyle = '#f2f2f2'
        ctx.canvas.fillRect(
          i * ctx.scale,
          j * ctx.scale,
          ctx.scale - 2,
          ctx.scale - 2,
        )
      }
    }
  }
  // @ts-ignore
  ctx.grid = new PF.Grid(ctx.w, ctx.h)

  for (var n = 0; n < ctx.typesArray.length; n++) {
    var block = ctx.typesArray[n]
    if (block.fit) {
      block.x = block.fit.x + ctx.padding
      block.y = block.fit.y + ctx.padding

      for (let i = block.x; i < block.x + block.w; i++) {
        for (let j = block.y; j < block.y + block.h; j++) {
          ctx.grid.setWalkableAt(i, j, false)
        }
      }

      let propIndex = 2
      for (const key in block.props) {
        const p = block.props[key]
        ctx.canvas.font = `${ctx.fontSize}px SF Pro Display`

        if (p.isRef) {
          ctx.canvas.fillStyle = 'black'
          ctx.canvas.fillText(
            key,
            (0.5 + block.x + p.x) * ctx.scale,
            (p.y + block.y) * ctx.scale + ctx.fontSize,
          )
        } else {
          if (p.name === '__self') {
            continue
          }

          ctx.canvas.fillStyle = '#888'
          ctx.canvas.fillText(
            key,
            (0.5 + block.x + p.x) * ctx.scale,
            (block.y + p.y) * ctx.scale + ctx.fontSize,
          )
        }
        propIndex++
      }

      ctx.canvas.fillStyle = 'black'
      ctx.canvas.font = `${ctx.fontSize * 1.4}px SF Pro Display`

      ctx.canvas.fillText(
        block.type,
        (0.5 + block.x) * ctx.scale,
        block.y * ctx.scale + ctx.fontSize * 2,
      )
    }
  }

  for (const type of ctx.typesArray) {
    for (const prop in type.props) {
      if (prop === '__self') {
        continue
      }
      const a = type.props[prop]

      if (!a.isRef) {
        continue
      }
      const b = ctx.types[a.reverseType].props[a.reverseProp]

      if (!b) {
        console.error('Cannot find b in relationship', a)
      }

      if (a.created) {
        continue
      }
      if (b.created) {
        continue
      }
      a.created = true
      b.created = true
      makePathBetweenBlocks(ctx, a, b)
    }
  }
}
