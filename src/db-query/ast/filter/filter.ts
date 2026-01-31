import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../../schema/defs/index.js'
import { PropType } from '../../../zigTsExports.js'
import { Ctx, FilterAst, FilterOp } from '../ast.js'
import { createCondition } from './condition.js'

type WalkCtx = {
  tree: PropTree
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
        // reference(astProp, ctx, prop)
      } else if (ops) {
        console.log({ ops })
        if (prop.id === 0) {
          main.push({ prop, ops })
        } else {
          for (const op of ops) {
            const cond = createCondition(prop, op.op, op.val, op.opts)
            ctx.query.set(cond, ctx.query.length)
          }
          //   includeProp(ctx, prop, include)
        }
      }
    } else {
      if (prop) {
        walk(astProp, ctx, typeDef, {
          main,
          tree: prop,
        })
      } else {
        // if EN, if NL
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return walkCtx
}

export const filter = (ast: FilterAst, ctx: Ctx, typeDef: TypeDef): number => {
  const startIndex = ctx.query.length
  // doink

  const { main } = walk(ast, ctx, typeDef, {
    main: [],
    tree: typeDef.tree,
  })

  console.log('collect dat main', main)

  for (const { prop, ops } of main) {
    for (const op of ops) {
      const cond = createCondition(prop, op.op, op.val, op.opts)
      console.log(cond)
      ctx.query.set(cond, ctx.query.length)
    }
  }
  // includeMainProps(ctx, main, typeDef)

  return ctx.query.length - startIndex
}
