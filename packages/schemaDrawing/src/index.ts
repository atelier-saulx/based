import drawPath from './drawPath.js'
import Pf from './pf.js'
import { SchemaProp, SchemaType } from '@based/schema'
import escSchema from './schema/based.schema.js'

Pf()

const SCALE = 25
const PADDING = 3
const MARGIN = 8
const PROP_HEIGHT = 1
const PROP_WIDTH = 5
const FONT_SIZE = PROP_HEIGHT * SCALE * 0.7

const globalW = Math.floor((window.innerWidth - SCALE * 2) / SCALE)
const globalH = Math.floor(5000 / SCALE)

type PropVisual = {
  prop: SchemaProp
  x: number
  y: number
  w: number
  h: number
  reverseType?: string
  many: boolean
  reverseProp?: string
  leftAnchor?: number
  rightAnchor?: number
  created: boolean
  name: string
  isRef: boolean
  type: TypeVisual
}

type TypeVisual = {
  schemaType: SchemaType
  type: string
  x: number
  y: number
  w: number
  h: number
  fit: any
  props: {
    [path: string]: PropVisual
  }
}

const types: TypeVisual[] = []
const typeMap: { [key: string]: TypeVisual } = {}

const walkProps = (type: SchemaType, collect, path = []) => {
  const target = type.props
  for (const key in target) {
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = schemaProp.type
    if (propType === 'object' || 'props' in schemaProp) {
      walkProps(schemaProp, collect, propPath)
    } else {
      if (propType || schemaProp.items || schemaProp.enum || schemaProp.ref) {
        collect[propPath.join('.')] = schemaProp
      }
    }
  }
}

const canvasMeasure = document.createElement('canvas')
canvasMeasure.height = 30
canvasMeasure.width = 200
const ctxMeasure = canvasMeasure.getContext('2d')
ctxMeasure.font = `${FONT_SIZE}px SF Pro Display`

const makeType = (type: string, schemaType: SchemaType): TypeVisual => {
  const collect = {}
  walkProps(schemaType, collect)

  const len = Object.keys(collect).length
  let w = PROP_WIDTH

  for (const prop in collect) {
    const textSize = Math.ceil(ctxMeasure.measureText(prop).width / SCALE)
    if (textSize + 1 > w) {
      w = textSize + 1
    }
  }

  const h = (len + 3) * PROP_HEIGHT

  //   console.log(h)
  const block: TypeVisual = {
    fit: {},
    x: 0,
    y: 0,
    w,
    h,
    schemaType,
    type,
    props: {
      __self: {
        // @ts-ignore
        type: {},
        name: '__self',
        prop: { type: 'json' },
        x: 0,
        y: -2,
        w,
        h: PROP_HEIGHT,
        many: false,
        reverseType: '',
        reverseProp: '__self',
        leftAnchor: -1,
        rightAnchor: -1,
        created: false,
      },
    },
  }
  block.props.__self.type = block

  //
  let maxW = block.w
  for (const key in schemaType.props) {
    const px = ctxMeasure.measureText(key)
    const w = Math.ceil(px.width / SCALE)
    if (w > maxW) {
      maxW > w
    }
  }

  typeMap[type] = block

  let propIndex = 2
  for (const key in collect) {
    const prop = collect[key]
    // console.log(key, prop)
    if (prop.items || prop.ref) {
      const isMany = 'items' in prop
      block.props[key] = {
        type: block,
        name: key,
        prop,
        x: 0,
        y: propIndex * PROP_HEIGHT,
        w,
        isRef: true,
        h: PROP_HEIGHT,
        many: isMany,
        reverseType: isMany ? prop.items.ref : prop.ref,
        reverseProp: (isMany ? prop.items.prop : prop.prop) || '__self',
        leftAnchor: -1,
        rightAnchor: w,
        created: false,
      }
      const p = block.props[key]
      const px = ctxMeasure.measureText(key)
      p.w = Math.ceil(px.width / SCALE)
    } else {
      block.props[key] = {
        type: block,
        name: key,
        prop,
        x: 0,
        y: propIndex * PROP_HEIGHT,
        w,
        isRef: false,
        h: PROP_HEIGHT,
        many: false,
        created: false,
      }
    }
    propIndex++
  }
  return block
}

// @ts-ignore
const finder = new PF.OrthogonalJumpPointFinder({
  allowDiagonal: false,
  // @ts-ignore
  heuristic: PF.Heuristic.euclidian,
})

const makePathBetweenBlocks = (grid, a: PropVisual, b: PropVisual) => {
  try {
    const p = [
      // a right, b left
      {
        startLeft: false,
        endLeft: true,
        a,
        b,
        path: finder.findPath(
          a.rightAnchor + a.type.x,
          a.y + a.type.y,
          b.leftAnchor + b.type.x,
          b.y + b.type.y,
          grid.clone(),
        ),
      },
      // a left, b right
      {
        startLeft: true,
        endLeft: false,
        a,
        b,
        path: finder.findPath(
          a.leftAnchor + a.type.x,
          a.y + a.type.y,
          b.rightAnchor + b.type.x,
          b.y + b.type.y,
          grid.clone(),
        ),
      },
      // a right, b right
      {
        startLeft: false,
        endLeft: false,
        a,
        b,
        path: finder.findPath(
          a.rightAnchor + a.type.x,
          a.y + a.type.y,
          b.rightAnchor + b.type.x,
          b.y + b.type.y,
          grid.clone(),
        ),
      },
      // a left, b left
      {
        startLeft: true,
        endLeft: true,
        a,
        b,
        path: finder.findPath(
          a.leftAnchor + a.type.x,
          a.y + a.type.y,
          b.leftAnchor + b.type.x,
          b.y + b.type.y,
          grid.clone(),
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
        p[0] = x - 1
      }
    }

    if (path.startLeft === false) {
      const w = a.w + a.x + 1 + a.type.x
      const x = path.path[0][0]
      const blocksDiff = x - w
      const y = path.path[0][1]
      for (let i = 1; i < blocksDiff + 1; i++) {
        path.path.unshift([x - i, y])
      }
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
    }

    if (b.name === '__self') {
      const lP = path.path[path.path.length - 1]
      path.path.push([lP[0], lP[1] + 1, 'v'])
      path.path.push([lP[0], lP[1] + 2, 'rt'])
    }

    drawPath(path, ctx, SCALE, grid)
  } catch (err) {
    console.error(err)
  }
}

const schema = escSchema

const Packer = function (w, h) {
  this.init(w, h)
}

Packer.prototype = {
  init: function (w, h) {
    this.root = { x: 0, y: 0, w: w, h: h }
  },
  fit: function (blocks) {
    var n, node, block
    for (n = 0; n < blocks.length; n++) {
      block = blocks[n]
      if ((node = this.findNode(this.root, block.w + MARGIN, block.h + MARGIN)))
        block.fit = this.splitNode(node, block.w + MARGIN, block.h + MARGIN)
    }
  },
  findNode: function (root, w, h) {
    if (root.used)
      return this.findNode(root.right, w, h) || this.findNode(root.down, w, h)
    else if (w <= root.w && h <= root.h) return root
    else return null
  },
  splitNode: function (node, w, h) {
    node.used = true
    node.down = {
      x: node.x,
      y: node.y + h,
      w: node.w,
      h: node.h - h,
    }
    node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h }
    return node
  },
}
if (schema.props) {
  // @ts-ignore
  types.push(makeType('root', { props: schema.props }))
}
for (const key in schema.types) {
  types.push(makeType(key, schema.types[key]))
}

var packer = new Packer(
  globalW - PADDING * 2 + MARGIN,
  globalH - PADDING * 2 + MARGIN,
)
types.sort((a, b) => {
  return b.h < a.h ? -1 : 1
}) // sort inputs for best results
packer.fit(types)

// --------------------------------------------
// RENDER TIME

// put in middle...
let canvash = window.innerHeight - SCALE * 2 - 20

for (var n = 0; n < types.length; n++) {
  const t = types[n]
  const max = (t.fit.y + PADDING * 2 + t.h) * SCALE

  if (max > canvash) {
    canvash = max
  }
}

const canvas = document.createElement('canvas')
canvas.height = canvash
canvas.width = window.innerWidth - SCALE * 2 - 25

canvas.style.margin = SCALE + 'px'

const ctx = canvas.getContext('2d')
type Ctx = typeof ctx
ctx.font = `${FONT_SIZE}px SF Pro Display`

document.body.appendChild(canvas)

const makeGrid = (ctx: Ctx) => {
  for (let i = 0; i < globalW; i++) {
    let j = 0
    for (let j = 0; j < globalH; j++) {
      ctx.fillStyle = '#f2f2f2'
      ctx.fillRect(i * SCALE, j * SCALE, SCALE - 2, SCALE - 2)
    }
  }
}

makeGrid(ctx)

// @ts-ignore
const grid = new PF.Grid(globalW, globalH)

for (var n = 0; n < types.length; n++) {
  var block = types[n]
  if (block.fit) {
    block.x = block.fit.x + PADDING
    block.y = block.fit.y + PADDING

    for (let i = block.x; i < block.x + block.w; i++) {
      for (let j = block.y; j < block.y + block.h; j++) {
        grid.setWalkableAt(i, j, false)
      }
    }

    let propIndex = 2
    for (const key in block.props) {
      const p = block.props[key]

      if (p.isRef) {
        ctx.fillStyle = 'black'
        ctx.font = `${FONT_SIZE}px SF Pro Display`
        ctx.fillText(
          key,
          (0.5 + block.x + p.x) * SCALE,
          (p.y + block.y) * SCALE + FONT_SIZE,
        )
      } else {
        if (p.name === '__self') {
          continue
        }

        ctx.fillStyle = '#bbb'
        ctx.fillText(
          key,
          (0.5 + block.x) * SCALE,
          (block.y + propIndex * PROP_HEIGHT) * SCALE + FONT_SIZE,
        )
      }
      propIndex++
    }

    ctx.fillStyle = 'black'
    ctx.fillText(
      block.type,
      (0.5 + block.x) * SCALE,
      block.y * SCALE + FONT_SIZE,
    )
  }
}

for (const type of types) {
  for (const prop in type.props) {
    if (prop === '__self') {
      continue
    }
    const a = type.props[prop]

    if (!a.isRef) {
      continue
    }
    // @ts-ignore
    const b = typeMap[a.reverseType].props[a.reverseProp]

    // @ts-ignore
    if (a.created) {
      continue
    }
    if (b.created) {
      continue
    }
    // @ts-ignore
    a.created = true
    b.created = true
    makePathBetweenBlocks(grid, a, b)
  }
}
