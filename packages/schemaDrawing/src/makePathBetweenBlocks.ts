import { SchemaDiagram } from './ctx.js'
import drawPath from './drawPath.js'
import { PropVisual } from './types.js'

export const makePathBetweenBlocks = (
  ctx: SchemaDiagram,
  a: PropVisual,
  b: PropVisual,
) => {
  try {
    const p = [
      // a right, b left
      {
        startLeft: false,
        endLeft: true,
        a,
        b,
        path: ctx.finder.findPath(
          a.rightAnchor + a.type.x,
          a.y + a.type.y,
          b.leftAnchor + b.type.x,
          b.y + b.type.y,
          ctx.grid.clone(),
        ),
      },
      // a left, b right
      {
        startLeft: true,
        endLeft: false,
        a,
        b,
        path: ctx.finder.findPath(
          a.leftAnchor + a.type.x,
          a.y + a.type.y,
          b.rightAnchor + b.type.x,
          b.y + b.type.y,
          ctx.grid.clone(),
        ),
      },
      // a right, b right
      {
        startLeft: false,
        endLeft: false,
        a,
        b,
        path: ctx.finder.findPath(
          a.rightAnchor + a.type.x,
          a.y + a.type.y,
          b.rightAnchor + b.type.x,
          b.y + b.type.y,
          ctx.grid.clone(),
        ),
      },
      // a left, b left
      {
        startLeft: true,
        endLeft: true,
        a,
        b,
        path: ctx.finder.findPath(
          a.leftAnchor + a.type.x,
          a.y + a.type.y,
          b.leftAnchor + b.type.x,
          b.y + b.type.y,
          ctx.grid.clone(),
        ),
      },
    ]

    let s = Infinity
    let path
    for (const x of p) {
      if (x.path.length === 0) {
        continue
      }
      if (x.path.length < s) {
        s = x.path.length
        path = x
      }
    }

    if (path.path.length === 2 && path.startLeft == false) {
      for (const p of path.path) {
        const x = p[0]
        p[0] = x - 2
      }
    }

    // else {
    if (path.startLeft === false) {
      const w = a.w + a.x + 1 + a.type.x
      const x = path.path[0][0]
      const blocksDiff = x - w
      const y = path.path[0][1]
      for (let i = 1; i < blocksDiff + 1; i++) {
        path.path.unshift([x - i, y])
      }
    } else {
      const p = path.path[0]
      path.path.unshift([p[0] + 1, p[1]])
    }

    if (path.endLeft === false) {
      const w = b.w + b.x + 1 + b.type.x
      const lP = path.path[path.path.length - 1]
      const x = lP[0]
      const blocksDiff = x - w
      const y = lP[1]
      for (let i = 1; i < blocksDiff + 1; i++) {
        path.path.push([x - i, y])
      }
    } else if (b.name !== '__self') {
      const p = path.path[path.path.length - 1]
      path.path.push([p[0] + 1, p[1]])
    }

    if (b.name === '__self') {
      const lP = path.path[path.path.length - 1]
      path.path.push([lP[0], lP[1] + 1, 'v'])
      path.path.push([lP[0], lP[1] + 2, 'v'])
      // path.path.push([lP[0], lP[1] + 1.8, 'v'])

      path.path.push([lP[0], lP[1] + 2.8, 'rt'])
    }
    // }

    drawPath(path, ctx)
  } catch (err) {
    console.error(err)
  }
}
