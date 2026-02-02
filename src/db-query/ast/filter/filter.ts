import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../../schema/defs/index.js'
import { debugBuffer } from '../../../sdk.js'
import { writeUint64 } from '../../../utils/uint8.js'
import { FilterOpCompare, ID_PROP, PropType } from '../../../zigTsExports.js'
import { Ctx, FilterAst, FilterOp } from '../ast.js'
import {
  conditionBuffer,
  conditionByteSize,
  createCondition,
} from './condition.js'

type WalkCtx = {
  tree: PropTree
  prop: number
  main: { prop: PropDef; ops: FilterOp[] }[]
}

const walk = (ast: FilterAst, ctx: Ctx, typeDef: TypeDef, walkCtx: WalkCtx) => {
  const { tree, main } = walkCtx

  for (const field in ast.props) {
    const prop = tree.get(field)
    const astProp = ast.props[field]
    const ops = astProp.ops

    // AND & OR
    if (isPropDef(prop)) {
      if (prop.type === PropType.references) {
        // references(astProp, ctx, prop)
      } else if (prop.type === PropType.reference) {
        // this can be added here
        // reference(astProp, ctx, prop)
      } else if (ops) {
        if (prop.id === 0) {
          main.push({ prop, ops })
        } else {
          walkCtx.prop = prop.id
          for (const op of ops) {
            // can prob just push this directly
            const condition = createCondition(prop, op.op, op.val, op.opts)
            ctx.query.set(condition, ctx.query.length)
          }
        }
      }
    } else {
      if (prop) {
        walk(astProp, ctx, typeDef, {
          main,
          tree: prop,
          prop: walkCtx.prop,
        })
      } else {
        // if EN, if NL
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return walkCtx
}

export const filter = (
  ast: FilterAst,
  ctx: Ctx,
  typeDef: TypeDef,
  filterIndex: number = 0,
  lastProp: number = ID_PROP,
): number => {
  const startIndex = ctx.query.length

  // need to pass the prop

  // or cond needs to be here

  const walkCtx = {
    main: [],
    tree: typeDef.tree,
    prop: lastProp,
  }

  if (ast.or) {
    ctx.query.reserve(conditionByteSize(8, 8))
  }

  const { main } = walk(ast, ctx, typeDef, walkCtx)

  for (const { prop, ops } of main) {
    // better to do main first scince they are usualy lighter filters...
    walkCtx.prop = prop.id
    for (const op of ops) {
      const condition = createCondition(prop, op.op, op.val, op.opts)
      ctx.query.set(condition, ctx.query.length)
    }
  }

  if (ast.or) {
    const resultSize = ctx.query.length - startIndex
    const nextOrIndex = resultSize + filterIndex

    const { offset, condition } = conditionBuffer(
      { id: lastProp, size: 8, start: 0 },
      8,
      { compare: FilterOpCompare.nextOrIndex, prop: PropType.null },
    )

    console.info('NEXT OR INDEX', nextOrIndex)
    console.dir(ast.or, { depth: 10 })
    writeUint64(condition, nextOrIndex, offset)
    ctx.query.set(condition, startIndex)
    // then add the actual OR cond

    filter(
      ast.or,
      ctx,
      typeDef,
      ctx.query.length - startIndex + filterIndex,
      walkCtx.prop,
    )
  }

  console.log('-------------------------DERP FILTER...')
  debugBuffer(ctx.query.data, startIndex, ctx.query.length)
  console.log('-------------------------DERP FILTER... DONE')

  return ctx.query.length - startIndex
}
