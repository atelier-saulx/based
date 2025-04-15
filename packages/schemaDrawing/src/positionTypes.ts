import { StrictSchemaType } from '@based/schema'
import { Ctx } from './ctx.js'
import { makeType } from './makeType.js'
import { TypeVisual, Node, Root } from './types.js'

const findNode = (ctx: Ctx, root: Root, w: number, h: number) => {
  if (root.used) {
    return findNode(ctx, root.right, w, h) || findNode(ctx, root.down, w, h)
  } else if (w <= root.w && h <= root.h) {
    return root
  }
  return null
}

const splitNode = (node: Node, w: number, h: number) => {
  node.used = true
  node.down = {
    x: node.x,
    y: node.y + h,
    w: node.w,
    h: node.h - h,
  }
  node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h }
  return node
}

const fit = (ctx: Ctx, root: Node) => {
  let node: Node
  let block: TypeVisual
  for (let n = 0; n < ctx.typesArray.length; n++) {
    block = ctx.typesArray[n]
    if (
      (node = findNode(ctx, root, block.w + ctx.margin, block.h + ctx.margin))
    ) {
      block.fit = splitNode(node, block.w + ctx.margin, block.h + ctx.margin)
    }
  }
}

export const positionTypes = (ctx: Ctx) => {
  const Packer = function (w, h) {
    this.init(w, h)
  }
  Packer.prototype = {
    init: function (w, h) {
      this.root = { x: 0, y: 0, w: w, h: h }
    },
  }
  if (ctx.schema.props) {
    let rootProps: StrictSchemaType
    // @ts-ignore
    rootProps = { props: ctx.schema.props }
    ctx.typesArray.push(makeType(ctx, '.props', rootProps))
  }
  for (const key in ctx.schema.types) {
    ctx.typesArray.push(makeType(ctx, key, ctx.schema.types[key]))
  }

  ctx.typesArray.sort((a, b) => {
    return b.h < a.h ? -1 : 1
  })

  fit(ctx, {
    x: 0,
    y: 0,
    w: ctx.w - ctx.padding * 2 + ctx.margin,
    h: ctx.h - ctx.padding * 2 + ctx.margin,
  })
}
